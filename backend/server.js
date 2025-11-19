import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CORS設定
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// シラバスデータの読み込み
let syllabusData = null;
function loadSyllabusData() {
  if (!syllabusData) {
    const dataPath = join(__dirname, 'data/syllabus.json');
    const data = readFileSync(dataPath, 'utf-8');
    syllabusData = JSON.parse(data);
  }
  return syllabusData;
}

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    app: 'CoursAI API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    gemini_configured: !!process.env.GEMINI_API_KEY
  });
});

// 固定データ取得API
app.get('/api/fixed-data', (req, res) => {
  try {
    const data = loadSyllabusData();
    res.json({
      departments: ['information_science'],
      grades: ['1', '2', '3', '4'],
      classes: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      terms: ['前期', '後期', '通年']
    });
  } catch (error) {
    console.error('Error loading fixed data:', error);
    res.status(500).json({ error: error.message });
  }
});

// プロンプト生成関数
function generatePrompt(userInput, relevantCourses) {
  const systemInstruction = `あなたは愛知県立大学の履修登録を支援する専門AIです。
学生の情報と履修可能科目データをもとに、最適な履修プランを3パターン提案してください。

【重要なルール】
- 1つの時限には1科目しか履修登録できません
- 総単位数は実際に登録可能な科目（時間割に配置された科目）のみで計算してください
- 同じ時限に複数の候補がある場合は、coursesリストには含めても良いですが、timetableには1科目のみ配置してください

【出力形式】
必ずJSON形式で以下の構造で返してください：

{
  "patterns": [
    {
      "name": "パターン名",
      "description": "説明",
      "total_credits": 実際に登録する科目の合計単位数（数値）,
      "courses": [
        {
          "id": "科目コード",
          "name": "科目名",
          "credits": 単位数（数値）,
          "day": "曜日（月/火/水/木/金）",
          "period": 時限（数値1〜6）,
          "reason": "推薦理由",
          "type": "科目区分"
        }
      ],
      "timetable": {
        "月": [{"period": 時限, "course": "科目名", "credits": 単位数}],
        "火": [],
        "水": [],
        "木": [],
        "金": []
      },
      "expected_workload": "軽め|普通|重め",
      "estimated_gpa": GPA予測値（数値）
    }
  ],
  "reasoning": "提案理由"
}

【提案ルール】
1. 必修科目は必ず含める
2. 時間割の重複を避ける（同じ曜日・時限に2つ以上配置しない）
3. ユーザーの目的に応じて科目を選ぶ
4. 希望時限を考慮する
5. 得意科目を活かし、苦手科目は避ける
6. 1日の最大コマ数を守る
7. 目標単位数に近づける`;

  const userPrompt = `
【学生情報】
- 学部: 情報科学部
- 学年: ${userInput.grade}年生
- クラス: ${userInput.class_number}
- 履修目的: ${userInput.purpose}
- 目標単位数: ${userInput.target_credits}単位
- 得意科目: ${userInput.good_subjects || '特になし'}
- 苦手科目: ${userInput.weak_subjects || '特になし'}
- 時限指定: ${userInput.schedule_no_preference ? '指定なし（全時間帯）' : JSON.stringify(userInput.schedule_preferences)}
- 1日の最大コマ数: ${userInput.max_classes_per_day === 'none' ? '制限なし' : userInput.max_classes_per_day + 'コマ'}
- 成績評価の好み: ${userInput.grading_preference}

【履修可能科目データ】
${JSON.stringify(relevantCourses, null, 2)}

上記をもとに、最適な履修プランを3パターン提案してください。`;

  return { systemInstruction, userPrompt };
}

// 履修提案API
app.post('/api/suggest', async (req, res) => {
  try {
    const userInput = req.body;
    const data = loadSyllabusData();
    
    console.log('📥 Request received:', {
      grade: userInput.grade,
      purpose: userInput.purpose,
      target_credits: userInput.target_credits
    });
    
    const gradeData = data.grades[userInput.grade];
    const relevantCourses = gradeData?.general_education || [];
    
    console.log(`📚 Found ${relevantCourses.length} courses`);
    
    const { systemInstruction, userPrompt } = generatePrompt(userInput, relevantCourses);
    
    console.log('🤖 Calling Gemini API...');
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    });
    
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('📤 Gemini response received');
    
    const cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonResult = JSON.parse(cleanedText);
    
    console.log('✅ JSON parsed successfully');
    res.json(jsonResult);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'AI処理に失敗しました',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('✅ CoursAI Backend Server Started!');
  console.log('='.repeat(60));
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log('='.repeat(60) + '\n');
});