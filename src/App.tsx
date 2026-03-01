import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Save, Plus, Trash2, Calendar, Download, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';

interface Announcement {
  id: string;
  text: string;
}

const weekdayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const formatDateForDisplay = (dateText: string) => {
  const match = dateText.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return dateText;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) return dateText;

  return `${year}년 ${month}월 ${day}일 ${weekdayNames[parsed.getDay()]}`;
};

const playSound = (type: 'pop' | 'tada') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'tada') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export default function App() {
  const [isEditing, setIsEditing] = useState(true);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${weekdayNames[today.getDay()]}`;
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: Date.now().toString(), text: '' }
  ]);
  const [showClosing, setShowClosing] = useState(false);

  const notebookRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Ensure stale persistent data from older versions does not get restored.
    localStorage.removeItem('school-announcements-v4');

    const saved = sessionStorage.getItem('school-announcements-v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date) setDate(parsed.date);
        if (parsed.announcements && parsed.announcements.length > 0) {
          setAnnouncements(parsed.announcements);
          setIsEditing(false);
        }
      } catch (e) {
        console.error('Failed to parse saved announcements');
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('school-announcements-v4', JSON.stringify({ date, announcements }));
  }, [date, announcements]);

  const handleAdd = () => {
    playSound('pop');
    const newId = Date.now().toString();
    setAnnouncements([...announcements, { id: newId, text: '' }]);
    setTimeout(() => {
      inputRefs.current[announcements.length]?.focus();
    }, 0);
  };

  const normalizeAnnouncementText = (text: string) => text.replace(/(\d)ㅔ/g, '$1p');

  const handleUpdate = (id: string, text: string) => {
    const normalizedText = normalizeAnnouncementText(text);
    setAnnouncements(announcements.map(a => a.id === id ? { ...a, text: normalizedText } : a));
  };

  const handleDelete = (index: number) => {
    playSound('pop');
    const newAnnouncements = [...announcements];
    newAnnouncements.splice(index, 1);
    setAnnouncements(newAnnouncements);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleComplete();
    } else if (e.key === 'Backspace' && announcements[index].text === '') {
      e.preventDefault();
      if (announcements.length > 1) {
        handleDelete(index);
        setTimeout(() => {
          inputRefs.current[index - 1]?.focus();
        }, 0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < announcements.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleComplete = () => {
    playSound('tada');
    setIsEditing(false);
    setShowClosing(false);
  };

  const handleSaveImage = async () => {
    if (!notebookRef.current) return;
    try {
      const dataUrl = await toPng(notebookRef.current, {
        backgroundColor: '#fffcf8',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });

      const match = date.match(/(\d+)\D+(\d+)\D+(\d+)/);
      const formattedDate = match
        ? `${match[1]}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`
        : date.replace(/[^0-9]/g, '');
      const filename = `${formattedDate || 'today'}_알림장.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save image', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const visibleAnnouncements = isEditing ? announcements : announcements.filter(a => a.text.trim() !== '');
  const totalItems = visibleAnnouncements.length + (showClosing ? 1 : 0);

  const getSizeClasses = (count: number) => {
    if (count <= 4) return { text: 'text-3xl md:text-5xl', py: 'py-3', minH: 'min-h-[4rem]', gap: 'gap-3' };
    if (count <= 6) return { text: 'text-2xl md:text-4xl', py: 'py-2', minH: 'min-h-[3rem]', gap: 'gap-2' };
    if (count <= 8) return { text: 'text-xl md:text-3xl', py: 'py-1.5', minH: 'min-h-[2.5rem]', gap: 'gap-1.5' };
    return { text: 'text-lg md:text-2xl', py: 'py-1', minH: 'min-h-[2rem]', gap: 'gap-1' };
  };

  const sizes = getSizeClasses(totalItems);
  const displayDate = formatDateForDisplay(date);

  return (
    <div className="h-screen p-3 md:p-6 text-[#2c1e16] flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-5xl flex justify-between items-end mb-4 gap-4 shrink-0">
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 md:w-40 md:h-40 hover:-translate-y-1 transition-transform duration-300 shrink-0">
            <img
              src="/bear.png"
              alt="알림장 곰돌이"
              className="w-full h-full object-contain drop-shadow-md"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full bg-[#A67C52] rounded-full flex items-center justify-center text-white text-xs text-center p-1 border-2 border-[#4a3728]">bear.png</div>';
              }}
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="bg-[#fff8ee] border-2 border-[#dcc7ae] rounded-[1.7rem] px-6 md:px-9 py-4 md:py-5 shadow-[0_8px_20px_rgba(121,74,34,0.10)]">
              <h1 className="text-4xl md:text-7xl text-[#75461f] tracking-[-0.035em] font-black leading-none">
                오늘의 알림장
              </h1>
              <div className="mt-3 h-[3px] w-20 md:w-28 rounded-full bg-[#d1b28f]" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          {!isEditing && (
            <button
              onClick={handleSaveImage}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-lg md:text-xl shadow-sm transition-all hover:-translate-y-0.5 bg-white text-[#8b5a2b] border-2 border-[#e8e0d5] hover:bg-[#fcfaf5] hover:border-[#d4c5b9]"
            >
              <Download className="w-5 h-5" /> 이미지 저장
            </button>
          )}
          <button
            onClick={() => {
              if (isEditing) {
                handleComplete();
              } else {
                playSound('pop');
                setIsEditing(true);
                setShowClosing(false);
                setTimeout(() => {
                  inputRefs.current[0]?.focus();
                }, 0);
              }
            }}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-lg md:text-xl shadow-sm transition-all hover:-translate-y-0.5 ${
              isEditing
                ? 'bg-[#5C8D6D] text-white hover:bg-[#4a7258] border-2 border-[#4a7258]'
                : 'bg-[#A67C52] text-white hover:bg-[#8b6844] border-2 border-[#8b6844]'
            }`}
          >
            {isEditing ? (
              <><Save className="w-5 h-5" /> 저장하기</>
            ) : (
              <><Pencil className="w-5 h-5" /> 수정하기</>
            )}
          </button>
        </div>
      </div>

      <div
        ref={notebookRef}
        className="w-full max-w-5xl flex-1 bg-[#fffcf8] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border-2 border-[#e8e0d5] relative flex flex-col min-h-0 overflow-hidden"
      >
        <div className="absolute left-4 md:left-8 top-0 bottom-0 w-8 flex flex-col justify-evenly py-6 border-r-2 border-[#f0eadd] z-10">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-[#fcfaf5] shadow-inner mx-auto border border-[#e8e0d5]"></div>
          ))}
        </div>

        <div className="pl-16 pr-8 py-8 md:pl-24 md:pr-12 md:py-10 flex-1 flex flex-col relative z-10 h-full">
          <div className={`flex items-center ${sizes.gap} ${sizes.text} text-[#5C8D6D] mb-4 pb-2 border-b-2 border-dashed border-[#5C8D6D]/30 w-fit shrink-0`}>
            <Calendar className="w-7 h-7 md:w-10 md:h-10 shrink-0" />
            {isEditing ? (
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#fcf8f2] border-b-2 border-[#5C8D6D] focus:outline-none px-4 py-1.5 w-[20rem] md:w-[30rem] text-center rounded-xl text-[#2c1e16] transition-colors"
              />
            ) : (
              <span className="px-4 py-1.5 bg-[#fcf8f2] rounded-xl border border-[#e8e0d5] text-[#2c1e16] shadow-sm">{displayDate}</span>
            )}
          </div>

          <div className="flex flex-col gap-0 flex-1 justify-start">
            {visibleAnnouncements.map((announcement, index) => (
              <div key={announcement.id} className={`flex items-center group border-b-2 border-[#f0eadd] ${sizes.minH} ${sizes.py} shrink-0`}>
                <span className={`${sizes.text} text-[#A67C52] w-10 md:w-14 shrink-0 font-bold leading-none`}>{index + 1}.</span>

                {isEditing ? (
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      value={announcement.text}
                      onChange={(e) => handleUpdate(announcement.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className={`flex-1 ${sizes.text} bg-transparent border-b-2 border-dashed border-[#d4c5b9] focus:outline-none focus:border-[#A67C52] focus:bg-[#fcf8f2] px-3 py-1 rounded-xl text-[#2c1e16] transition-colors`}
                      placeholder="내용을 입력하세요"
                    />
                    <button
                      onClick={() => handleDelete(index)}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
                      tabIndex={-1}
                    >
                      <Trash2 className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                ) : (
                  <p className={`flex-1 ${sizes.text} text-[#2c1e16] leading-relaxed md:leading-relaxed break-keep tracking-wide`}>
                    {announcement.text}
                  </p>
                )}
              </div>
            ))}

            {isEditing && (
              <div className={`flex items-center ${sizes.minH} mt-2 shrink-0`}>
                <button
                  onClick={handleAdd}
                  className={`flex items-center gap-2 ${sizes.text} text-[#5C8D6D] hover:text-[#4a7258] hover:bg-[#f0f5f2] px-5 py-2 rounded-2xl transition-colors border-2 border-dashed border-[#5C8D6D]/50 hover:border-[#4a7258] w-full justify-center`}
                >
                  <Plus className="w-6 h-6 md:w-7 md:h-7" /> + 항목 추가
                </button>
              </div>
            )}

            {!isEditing && showClosing && (
              <div className={`flex items-center group border-b-2 border-[#f0eadd] ${sizes.minH} ${sizes.py} shrink-0`}>
                <span className={`${sizes.text} text-[#A67C52] w-10 md:w-14 shrink-0 font-bold leading-none`}>{visibleAnnouncements.length + 1}.</span>
                <p className={`flex-1 ${sizes.text} text-[#e05a5a] leading-relaxed mt-1 break-keep font-bold tracking-wide`}>
                  {"차 조심, 낯선 사람 조심!".split('').map((char, i) => (
                    <span
                      key={i}
                      className="inline-block animate-bounce-in"
                      style={{ animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {!isEditing && !showClosing && (
              <div className="mt-4 flex justify-center shrink-0">
                <button
                  onClick={() => {
                    playSound('pop');
                    setShowClosing(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-white text-[#5C8D6D] rounded-2xl border-2 border-[#e8e0d5] hover:border-[#5C8D6D] hover:bg-[#fcfaf5] transition-all text-xl shadow-sm hover:-translate-y-0.5"
                >
                  <Sparkles className="w-5 h-5" /> 마침말 보기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 text-[#5C8D6D] text-xl md:text-2xl flex items-center gap-2.5 bg-[#fcfaf5] px-6 py-2.5 rounded-full border border-[#e8e0d5] font-medium shadow-sm shrink-0">
        <span>선생님이 적어주신 알림장을 또박또박 예쁘게 적어보아요!</span>
        <span className="text-3xl drop-shadow-sm">✏️</span>
      </div>
    </div>
  );
}

