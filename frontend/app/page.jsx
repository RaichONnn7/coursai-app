'use client';

  // 先頭に追加した。

import React, { useState } from 'react';
import { BookOpen, Sparkles, ChevronRight, X, Clock, AlertCircle, CheckCircle, Calendar, Award, TrendingUp } from 'lucide-react';

export default function CoursAIApp() {
  const [step, setStep] = useState('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    department: 'information_science',
    grade: '1',
    class_number: 'A',
    term: '前期',
    purpose: 'balance',
    purpose_other: '',
    target_credits: '20',
    schedule_preferences: {
      '月': [],
      '火': [],
      '水': [],
      '木': [],
      '金': []
    },
    schedule_no_preference: false,
    max_classes_per_day: 'none',
    grading_preference: 'any',
    good_subjects: '',
    weak_subjects: ''
  });
  const [result, setResult] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const API_URL = 'http://localhost:8080';

  const handleSubmit = async () => {
    // ボタン連打防止
    if (loading) {
      console.log('⚠️ 既に処理中です');
      return;
    }
    
    console.log('🚀 履修プラン検索開始');
    setLoading(true);
    setError(null);
    
    // 入力チェック
    if (!formData.target_credits || formData.target_credits < 1) {
      setError('目標単位数を入力してください');
      setLoading(false);
      return;
    }

    console.log('📊 入力データ:', formData);
    
    try {
      // バックエンドサーバーにリクエストを送信
      const response = await fetch(`${API_URL}/api/generate-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_info: {
            department: formData.department,
            grade: formData.grade,
            class_number: formData.class_number,
            term: formData.term
          },
          conditions: {
            target_credits: formData.target_credits,
            purpose: formData.purpose === 'other' ? formData.purpose_other : formData.purpose,
            good_subjects: formData.good_subjects,
            weak_subjects: formData.weak_subjects,
            schedule_preferences: formData.schedule_no_preference ? null : formData.schedule_preferences,
            max_classes_per_day: formData.max_classes_per_day,
            grading_preference: formData.grading_preference
          }
        })
      });

      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }

      const apiResult = await response.json();
      
      console.log('📥 API Response:', apiResult);
      
      // 時間割データを生成
      const enrichedPatterns = apiResult.patterns.map(pattern => {
        const timetable = {
          "月": [],
          "火": [],
          "水": [],
          "木": [],
          "金": []
        };
        
        pattern.courses.forEach(course => {
          if (timetable[course.day]) {
            timetable[course.day].push({
              period: course.period,
              course: course.name,
              credits: course.credits
            });
          }
        });
        
        // 各曜日の時限順にソート
        Object.keys(timetable).forEach(day => {
          timetable[day].sort((a, b) => a.period - b.period);
        });
        
        // 時間割から総単位数と科目数を算出
        const allCourses = Object.values(timetable).flat();
        const totalCredits = allCourses.reduce((sum, course) => sum + course.credits, 0);
        
        return {
          ...pattern,
          timetable,
          total_credits: totalCredits
        };
      });
      
      const finalResult = {
        patterns: enrichedPatterns,
        reasoning: apiResult.reasoning
      };
      
      console.log('✅ 履修プラン生成完了:', finalResult);
      setResult(finalResult);
      setStep('result');
      
    } catch (err) {
      console.error('❌ エラー:', err);
      setError('履修プランの生成に失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePeriod = (day, period) => {
    setFormData(prev => {
      const currentPeriods = prev.schedule_preferences[day] || [];
      const newPeriods = currentPeriods.includes(period)
        ? currentPeriods.filter(p => p !== period)
        : [...currentPeriods, period].sort((a, b) => a - b);
      
      return {
        ...prev,
        schedule_preferences: {
          ...prev.schedule_preferences,
          [day]: newPeriods
        }
      };
    });
  };

  const renderTimetable = (timetable) => {
    const days = ['月', '火', '水', '木', '金'];
    const periods = [1, 2, 3, 4, 5, 6];
    
    return (
      <div className="overflow-x-auto -mx-3 md:mx-0 mb-4">
        <div className="inline-block min-w-full px-3 md:px-0">
          <table className="w-full border-collapse border border-gray-300" style={{ minWidth: '480px' }}>
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <th className="border border-gray-300 p-2 text-xs font-bold text-gray-700 bg-blue-50 w-12">時限</th>
                {days.map(day => (
                  <th key={day} className="border border-gray-300 p-2 text-xs font-bold text-gray-700">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period}>
                  <td className="border border-gray-300 p-2 text-center text-xs font-semibold bg-gray-50">{period}</td>
                  {days.map(day => {
                    const cell = timetable[day]?.find(c => c.period === period);
                    return (
                      <td key={day} className="border border-gray-300 p-1">
                        {cell ? (
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-2 rounded shadow-sm">
                            <div className="font-bold text-blue-900 text-xs leading-tight break-words">{cell.course}</div>
                            <div className="text-blue-600 text-xs mt-1">{cell.credits}単位</div>
                          </div>
                        ) : (
                          <div className="text-gray-300 text-center py-3 text-xs">-</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (step === 'result' && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-3 md:p-6 mb-4 md:mb-6">
            <div className="flex flex-col gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h1 className="text-base md:text-2xl font-bold text-gray-800">履修プラン提案完了</h1>
                </div>
                <p className="text-xs md:text-sm text-gray-500">愛知県立大学 実際のシラバスデータに基づく提案</p>
                <p className="text-xs text-blue-600 mt-1">Powered by Google Gemini 1.5 Flash</p>
              </div>
              <button
                onClick={() => {
                  setStep('input');
                  setError(null);
                }}
                className="w-full md:w-auto px-5 py-2 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg hover:from-gray-200 hover:to-gray-300 transition text-sm font-medium shadow-sm"
              >
                条件を変更
              </button>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <p className="text-xs md:text-base text-gray-700 leading-relaxed">{result.reasoning}</p>
            </div>
          </div>

          {result.patterns.map((pattern, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-lg p-3 md:p-6 mb-4 md:mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-2 rounded-lg">
                  <Sparkles className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
                <h2 className="text-base md:text-xl font-bold text-gray-800">{pattern.name}</h2>
              </div>
              <p className="text-xs md:text-base text-gray-600 mb-4 leading-relaxed">{pattern.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl text-center shadow-sm">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Award className="w-3 h-3 text-blue-600" />
                    <div className="text-xs text-blue-600 font-medium">総単位</div>
                  </div>
                  <div className="text-xl md:text-3xl font-bold text-blue-700">{pattern.total_credits}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl text-center shadow-sm">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookOpen className="w-3 h-3 text-green-600" />
                    <div className="text-xs text-green-600 font-medium">科目数</div>
                  </div>
                  <div className="text-xl md:text-3xl font-bold text-green-700">{pattern.courses.length}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl text-center shadow-sm">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-purple-600" />
                    <div className="text-xs text-purple-600 font-medium">負荷</div>
                  </div>
                  <div className="text-sm md:text-xl font-bold text-purple-700">{pattern.expected_workload}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-xl text-center shadow-sm">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-orange-600" />
                    <div className="text-xs text-orange-600 font-medium">予測GPA</div>
                  </div>
                  <div className="text-xl md:text-3xl font-bold text-orange-700">{pattern.estimated_gpa}</div>
                </div>
              </div>

              <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                週間時間割
              </h3>
              {renderTimetable(pattern.timetable)}

              <h3 className="font-bold text-gray-800 mt-4 mb-3 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                履修科目詳細
              </h3>
              <div className="space-y-2">
                {pattern.courses.map((course, cidx) => (
                  <div key={cidx} className="border-l-4 border-blue-500 bg-gray-50 rounded-lg p-3 shadow-sm">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-gray-800 text-xs md:text-base break-words">{course.name}</span>
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono whitespace-nowrap">{course.id}</span>
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">{course.credits}単位</span>
                        <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">{course.day}曜{course.period}限</span>
                        <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">{course.type}</span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{course.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-xs md:text-sm text-gray-600 mb-2">💡 このプランは愛知県立大学の実際のシラバスに基づいています</p>
            <p className="text-xs text-gray-500">履修登録前に必ず最新のシラバスで詳細を確認してください</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-4 md:p-10">
          <div className="text-center mb-6 md:mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2 md:p-3 rounded-xl">
                <BookOpen className="w-6 h-6 md:w-10 md:h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  CoursAI
                </h1>
                <p className="text-xs text-gray-500">こーせい｜愛知県立大学 非公式</p>
              </div>
            </div>
            <p className="text-xs md:text-base text-gray-600 mb-2">AIが最適な履修プランを提案します</p>
            <div className="inline-block bg-gradient-to-r from-green-50 to-blue-50 px-3 py-1.5 rounded-full border border-green-200">
              <p className="text-xs text-green-700 font-medium">✨ Powered by Google Gemini 1.5 Flash</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs md:text-sm font-semibold text-red-800">エラーが発生しました</p>
                <p className="text-xs md:text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4 md:space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">基本情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">所属学部</label>
                  <select
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                    style={{ minHeight: '44px' }}
                  >
                    <option value="information_science">情報科学部</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">学年</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => handleInputChange('grade', e.target.value)}
                    className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                    style={{ minHeight: '44px' }}
                  >
                    <option value="1">1年生</option>
                    <option value="2">2年生</option>
                    <option value="3">3年生</option>
                    <option value="4">4年生</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">必須教養科目のクラス</label>
                  <select
                    value={formData.class_number}
                    onChange={(e) => handleInputChange('class_number', e.target.value)}
                    className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                    style={{ minHeight: '44px' }}
                  >
                    {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => (
                      <option key={letter} value={letter}>{letter}クラス</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">履修学期</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: '前期', label: '前期', icon: '🌸' },
                    { value: '後期', label: '後期', icon: '🍂' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleInputChange('term', opt.value)}
                      className={`p-3 rounded-xl border-2 transition text-sm md:text-base ${
                        formData.term === opt.value
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl md:text-2xl mr-2">{opt.icon}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-3">履修の目的</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {[
                  { value: 'credits', label: '単位取得重視', icon: '✅' },
                  { value: 'good_subjects', label: '得意科目重視', icon: '💪' },
                  { value: 'balance', label: 'バランス', icon: '⚖️' },
                  { value: 'gpa', label: 'GPA向上重視', icon: '📈' },
                  { value: 'other', label: 'その他', icon: '✏️' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleInputChange('purpose', opt.value)}
                    className={`p-2 md:p-3 rounded-xl border-2 transition text-xs md:text-base ${
                      formData.purpose === opt.value
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl md:text-2xl mr-1">{opt.icon}</span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              {formData.purpose === 'other' && (
                <textarea
                  value={formData.purpose_other}
                  onChange={(e) => handleInputChange('purpose_other', e.target.value)}
                  placeholder="その他の目的を入力してください"
                  className="w-full mt-3 p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              )}
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                今期の目標単位数 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.target_credits}
                onChange={(e) => handleInputChange('target_credits', e.target.value)}
                placeholder="例: 20"
                className="w-full p-2 md:p-3 text-sm md:text-lg border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              />
              <p className="text-xs text-gray-500 mt-1">※ 通常は16〜24単位が推奨されています</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">得意科目</label>
                <textarea
                  value={formData.good_subjects}
                  onChange={(e) => handleInputChange('good_subjects', e.target.value)}
                  placeholder="例: 数学、物理、プログラミング"
                  className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">苦手科目</label>
                <textarea
                  value={formData.weak_subjects}
                  onChange={(e) => handleInputChange('weak_subjects', e.target.value)}
                  placeholder="例: 外国語、歴史"
                  className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-3">
                <Clock className="inline w-3 h-3 md:w-4 md:h-4 mr-1" />
                曜日ごとの履修希望時限
              </label>
              
              <div className="mb-3">
                <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={formData.schedule_no_preference}
                    onChange={(e) => {
                      handleInputChange('schedule_no_preference', e.target.checked);
                      if (e.target.checked) {
                        // 「指定しない」をチェックした場合、すべての時限選択をクリア
                        handleInputChange('schedule_preferences', {
                          '月': [],
                          '火': [],
                          '水': [],
                          '木': [],
                          '金': []
                        });
                        setSelectedDay(null);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    時限を指定しない（すべての時間帯で検索）
                  </span>
                </label>
              </div>

              {!formData.schedule_no_preference && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {['月', '火', '水', '木', '金'].map(day => {
                      const selectedPeriods = formData.schedule_preferences[day];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                          className={`px-3 md:px-5 py-2 md:py-3 rounded-xl border-2 transition text-sm ${
                            selectedDay === day
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : selectedPeriods.length > 0
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium">{day}曜日</div>
                          {selectedPeriods.length > 0 && (
                            <div className="text-xs text-gray-600 mt-1">
                              {selectedPeriods.join(', ')}限
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedDay && (
                    <div className="bg-gray-50 p-3 md:p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm md:text-base font-semibold text-gray-800">{selectedDay}曜日の希望時限を選択</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDay(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {[1, 2, 3, 4, 5, 6].map(period => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => togglePeriod(selectedDay, period)}
                            className={`px-3 py-2 md:px-4 md:py-3 text-sm rounded-lg border-2 transition font-medium ${
                              formData.schedule_preferences[selectedDay].includes(period)
                                ? 'border-blue-500 bg-blue-100 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {period}限
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">1日の最大コマ数</label>
              <select
                value={formData.max_classes_per_day}
                onChange={(e) => handleInputChange('max_classes_per_day', e.target.value)}
                className="w-full p-2 md:p-3 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">指定しない</option>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n}コマ</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">成績評価の好み</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                {[
                  { value: 'test', label: 'テスト重視' },
                  { value: 'report', label: 'レポート重視' },
                  { value: 'any', label: 'どちらでも可' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleInputChange('grading_preference', opt.value)}
                    className={`p-2 md:p-3 text-sm rounded-lg border-2 transition ${
                      formData.grading_preference === opt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t-2 border-gray-200 pt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-base active:scale-98 cursor-pointer"
                style={{ minHeight: '56px', touchAction: 'manipulation' }}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>検索中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>履修プランの検索</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}