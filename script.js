const PAGES = ['home', 'intro', 'goals', 'smart', 'understanding', 'control', 'finish', 'summary'];
const CHAPTER_ORDER = ['intro', 'goals', 'smart', 'understanding', 'control', 'finish', 'summary'];
const CHAPTER_NAMES = {
  home: '',
  intro: 'Введение',
  goals: 'Цели на смену',
  smart: 'Цели по SMART',
  understanding: 'Проверка понимания',
  control: 'Управление в течение смены',
  finish: 'Завершение смены',
  summary: 'Главное по теме'
};

const PROGRESS_KEY = 'daily_goals_course_progress_v3';
const PROGRESS_VERSION = 3;
let currentPage = 'home';
let unlockedChapters = 1;
let fadeObserver;

function navigateTo(pageId) {
  const target = document.getElementById(`page-${pageId}`);
  if (!target) return;
  const requestedChapter = CHAPTER_ORDER.indexOf(pageId);
  if (requestedChapter >= unlockedChapters) return;

  PAGES.forEach(id => document.getElementById(`page-${id}`)?.classList.remove('active'));
  target.classList.add('active');
  currentPage = pageId;
  window.scrollTo({ top: 0, behavior: 'instant' });

  const chapterIndex = requestedChapter;
  document.getElementById('nav-chapter').textContent = CHAPTER_NAMES[pageId] || '';
  document.getElementById('nav-progress').textContent = chapterIndex >= 0 ? `${chapterIndex + 1} / ${CHAPTER_ORDER.length}` : '';
  document.getElementById('progress-bar').style.width = chapterIndex >= 0 ? `${Math.round((chapterIndex + 1) / CHAPTER_ORDER.length * 100)}%` : '0%';

  if (chapterIndex >= 0) {
    const nextUnlocked = Math.min(chapterIndex + 2, CHAPTER_ORDER.length);
    if (nextUnlocked > unlockedChapters) {
      unlockedChapters = nextUnlocked;
      saveProgress();
    }
  }
  applyHomeLocks();
  setTimeout(initFadeIn, 30);
}

function initFadeIn() {
  fadeObserver?.disconnect();
  const elements = document.querySelectorAll('.page.active .fade-in:not(.visible)');
  if (!('IntersectionObserver' in window)) {
    elements.forEach(element => element.classList.add('visible'));
    return;
  }
  fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -30px' });
  elements.forEach(element => {
    if (element.getBoundingClientRect().top < window.innerHeight) element.classList.add('visible');
    else fadeObserver.observe(element);
  });
}

function applyHomeLocks() {
  CHAPTER_ORDER.forEach((chapter, index) => {
    document.getElementById(`home-card-${index + 1}`)?.classList.toggle('locked', index >= unlockedChapters);
  });
}

function saveProgress() {
  const state = JSON.stringify({ version: PROGRESS_VERSION, unlocked: unlockedChapters, page: currentPage });
  try { localStorage.setItem(PROGRESS_KEY, state); } catch (error) {}
  if (window.SCORM && typeof SCORM.set === 'function') {
    try {
      SCORM.set('cmi.suspend_data', state);
      const status = SCORM.get?.('cmi.core.lesson_status');
      if (!status || status === 'not attempted' || status === 'unknown') SCORM.set('cmi.core.lesson_status', 'incomplete');
      SCORM.commit?.();
    } catch (error) {}
  }
}

function loadProgress() {
  let stored = '';
  if (window.SCORM && typeof SCORM.get === 'function') {
    try { stored = SCORM.get('cmi.suspend_data') || ''; } catch (error) {}
  }
  if (!stored) {
    try { stored = localStorage.getItem(PROGRESS_KEY) || ''; } catch (error) {}
  }
  if (stored) {
    try {
      const state = JSON.parse(stored);
      if (state.version === PROGRESS_VERSION && Number.isFinite(state.unlocked)) unlockedChapters = Math.max(1, Math.min(state.unlocked, CHAPTER_ORDER.length));
    } catch (error) {}
  }
  applyHomeLocks();
}

function answerChoice(button, isCorrect, feedbackId) {
  const feedback = document.getElementById(feedbackId);
  const group = button.closest('.choice-grid, .choice-list');
  if (!feedback || !group || group.dataset.solved === 'true') return;

  const caseFeedback = {
    'case-feedback-1': {
      correct: '<strong>Верно.</strong> 250 − 95 = 155 порций — это остаток цели для вечерней смены.',
      incorrect: '<strong>Посчитай остаток.</strong> Из общей цели 250 вычти 95 порций, которые уже продали утром.'
    },
    'case-feedback-2': {
      correct: '<strong>Верно.</strong> 350 000 − 148 000 = 202 000 рублей — столько нужно заработать вечером.',
      incorrect: '<strong>Посчитай остаток.</strong> Из общей цели по товарообороту вычти утренний результат.'
    },
    'case-feedback-3': {
      correct: '<strong>Верно.</strong> Нулевая цель по негативным отзывам сохраняется на протяжении всей смены.',
      incorrect: '<strong>Вспомни общую цель.</strong> Если утром негативных отзывов не было, вечерняя смена должна сохранить этот результат.'
    }
  };
  const copy = caseFeedback[feedbackId];

  if (isCorrect) {
    button.classList.add('correct');
    group.dataset.solved = 'true';
    group.querySelectorAll('button').forEach(item => item.disabled = true);
    feedback.className = 'feedback-box show correct';
    feedback.innerHTML = copy?.correct || (feedbackId === 'calc-feedback'
      ? '<strong>Верно.</strong> 150 000 × 20 / 100 = 30 000 рублей за смену.'
      : '<strong>Верно.</strong> Сначала проверь понимание цели и найди причину отклонения. Только после этого выбирай действие, которое поможет кассиру вернуться к плану.');
  } else {
    button.classList.add('wrong');
    feedback.className = 'feedback-box show incorrect';
    feedback.innerHTML = copy?.incorrect || (feedbackId === 'calc-feedback'
      ? '<strong>Пока нет.</strong> Найди 20% от 150 000: умножь сумму на 20 и раздели на 100.'
      : '<strong>Попробуй ещё раз.</strong> Задача контроля — вовремя помочь, а не наказать или отложить проблему до конца смены.');
    setTimeout(() => button.classList.remove('wrong'), 650);
  }
}

const SMART_DETAILS = [
  ['S · Specific', 'Цель называет конкретный результат и не оставляет места разным трактовкам.'],
  ['M · Measurable', 'У результата есть число или другой показатель, по которому можно проверить выполнение.'],
  ['A · Achievable', 'Цель амбициозна, но учитывает опыт и реальные возможности конкретного сотрудника.'],
  ['R · Relevant', 'Индивидуальная цель сотрудника помогает выполнить общую цель ресторана.'],
  ['T · Time-bound', 'У цели есть понятный срок или временной интервал.']
];

function selectSmart(button, index) {
  document.querySelectorAll('.smart-card').forEach(card => card.classList.remove('active'));
  button.classList.add('active');
  const [title, text] = SMART_DETAILS[index];
  document.getElementById('smart-detail').innerHTML = `<span>${title}</span><p>${text}</p>`;
}

function toggleSmartBreakdown() {
  const panel = document.getElementById('smart-breakdown');
  const button = document.querySelector('.smart-reveal-btn');
  if (!panel || !button) return;
  const isOpen = panel.classList.toggle('smart-breakdown-open');
  panel.classList.toggle('visible', isOpen);
  button.classList.toggle('active', isOpen);
  button.innerHTML = isOpen ? 'Скрыть разбор SMART <span>−</span>' : 'Разобрать эту цель по SMART <span>＋</span>';
  if (isOpen) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function checkSmartBuilder() {
  const fields = ['smart-s', 'smart-m', 'smart-a', 'smart-r', 'smart-t'].map(id => document.getElementById(id));
  const missing = fields.filter(field => !field.value.trim());
  fields.forEach(field => field.classList.toggle('missing', !field.value.trim()));
  const feedback = document.getElementById('smart-feedback');
  if (missing.length) {
    feedback.className = 'feedback-box show incorrect';
    feedback.innerHTML = `<strong>Нужно ещё немного конкретики.</strong> Заполни ${missing.length === 1 ? 'оставшееся поле' : `оставшиеся поля: ${missing.length}`} — хорошая SMART-цель держится на всех пяти опорах.`;
    missing[0].focus();
    return;
  }
  feedback.className = 'feedback-box show correct';
  feedback.innerHTML = `<strong>Все пять критериев на месте.</strong><br>Твоя заготовка: «${fields[0].value.trim()}: ${fields[1].value.trim()}. Это достижимо, потому что ${fields[2].value.trim().toLowerCase()}. Цель помогает: ${fields[3].value.trim().toLowerCase()}. Срок: ${fields[4].value.trim()}».`;
}

function toggleReason(button) {
  const card = button.closest('.reason-card');
  const isOpen = card.classList.toggle('open');
  button.setAttribute('aria-expanded', String(isOpen));
}

function answerReflection(answer) {
  const feedback = document.getElementById('reflection-feedback');
  feedback.classList.add('show');
  feedback.innerHTML = answer === 'no'
    ? '<strong>Именно так мыслит менеджер, который управляет результатом.</strong><br>А теперь представьте, что по-настоящему эффективный менеджер в этой ситуации скажет: «Если моя команда не достигла целей — значит, я где-то недодал обратную связь, не скорректировал работу вовремя или плохо поставил задачу».'
    : '<strong>Ответственность сотрудника важна, но менеджер влияет на условия выполнения.</strong><br>А теперь представьте, что по-настоящему эффективный менеджер в этой ситуации скажет: «Если моя команда не достигла целей — значит, я где-то недодал обратную связь, не скорректировал работу вовремя или плохо поставил задачу».';
}

function speakText(elementId) {
  const element = document.getElementById(elementId);
  if (!element || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(element.textContent.trim());
  utterance.lang = 'ru-RU';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function downloadGoalTemplate() {
  downloadText('Шаблон постановки целей.txt', `ШАБЛОН ПОСТАНОВКИ ЦЕЛЕЙ НА СМЕНУ

Дата: ____________________   Смена: ____________________
Менеджер смены: _______________________________________

1. ОБЩИЕ ЦЕЛИ РЕСТОРАНА
Товарооборот: _________________________________________
Продажи приоритетных позиций: _________________________
Отзывы / сервис: ______________________________________

2. РАСПРЕДЕЛЕНИЕ ЦЕЛЕЙ
Сотрудник: ____________________________________________
Зона: _________________________________________________
Индивидуальная цель: __________________________________
Как сотрудник может её достичь: _______________________
Контрольные точки: ____________________________________

3. ПРОВЕРКА SMART
[ ] Конкретная   [ ] Измеримая   [ ] Достижимая
[ ] Релевантная  [ ] Ограниченная во времени

4. ПРОВЕРКА
Если все сотрудники выполнят свои индивидуальные цели, будет ли выполнена общая цель на смену?
Ответ: __________________________________________________
`);
}

function downloadControlChecklist() {
  downloadText('Чек-лист контроля целей.txt', `ЧЕК-ЛИСТ КОНТРОЛЯ ЦЕЛЕЙ В ТЕЧЕНИЕ СМЕНЫ

КАЖДЫЕ 30 МИНУТ
[ ] Сверить факт с Бланком получасовых продаж
[ ] Проверить индивидуальные цели сотрудников
[ ] Сообщить команде промежуточный результат
[ ] Дать позитивную или корректирующую обратную связь

ЕСЛИ ЕСТЬ ОТКЛОНЕНИЕ
[ ] Сотрудник понимает задачу?
[ ] У него получается выполнить задачу?
[ ] Сотрудник не устал?
[ ] Сотрудник дружелюбен с гостями?
[ ] Что мешает и какое действие нужно скорректировать?

В КОНЦЕ СМЕНЫ
[ ] Проверить итоги
[ ] Сообщить результат команде
[ ] Поблагодарить и выделить лучших
[ ] Записать причины отклонений
[ ] Обсудить план действий с директором
[ ] Собрать мнение команды
[ ] Дать обратную связь каждому
`);
}

function printChecklist() {
  const previousPage = currentPage;
  navigateTo('understanding');
  setTimeout(() => {
    window.print();
    if (previousPage !== 'understanding') navigateTo(previousPage);
  }, 150);
}

function completeCourse() {
  unlockedChapters = CHAPTER_ORDER.length;
  saveProgress();
  try { localStorage.setItem(`${PROGRESS_KEY}_completed`, 'passed'); } catch (error) {}
  if (window.SCORM && typeof SCORM.set === 'function') {
    try {
      SCORM.set('cmi.core.lesson_status', 'passed');
      SCORM.set('cmi.core.score.raw', '100');
      SCORM.commit?.();
    } catch (error) {}
  }
  document.getElementById('completion-panel')?.classList.add('show');
  applyHomeLocks();
}

document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  navigateTo('home');
});

window.addEventListener('load', loadProgress);
