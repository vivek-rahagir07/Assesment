import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const app_id = typeof __app_id !== 'undefined' ? __app_id : 'interview-evaluator-pro';
const rawFirebaseConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;

const fallbackConfig = {
  apiKey: 'AIzaSyD_rWk0lI2jZpciOkf84-argl8dmTYvAFI',
  authDomain: 'interview-assesment-6a72e.firebaseapp.com',
  databaseURL: 'https://interview-assesment-6a72e-default-rtdb.firebaseio.com',
  projectId: 'interview-assesment-6a72e',
  storageBucket: 'interview-assesment-6a72e.firebasestorage.app',
  messagingSenderId: '90308736233',
  appId: '1:90308736233:web:345bf112909e6280c82c78',
  measurementId: 'G-GJCXMKS3Q1'
};

const firebaseConfig = rawFirebaseConfig ? JSON.parse(rawFirebaseConfig) : fallbackConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let currentWorkspace = null;
let templates = [];
let candidates = [];
let activeInterviewTemplate = null;
let candidateScores = {};
let candidateNotes = {};
let likertResponses = {};
let interviewDuration = 0;
let timerInterval = null;
let scoreThresholds = { high: 80, low: 50 };
let filterRole = 'All';
let filterQuery = '';
let builderCriteria = [];
let editingTemplateId = null;

const MANDATORY_CRITERIA_DEFAULTS = [
  { id: 'crit-comm-verbal', name: 'Communication Skills (verbal)', category: 'Communication', maxScore: 3, weight: 15, desc: 'Assess verbal fluency, clarity of thoughts, explanation quality.' },
  { id: 'crit-comm-nonverbal', name: 'Communication Skills (non-verbal)', category: 'Communication', maxScore: 3, weight: 15, desc: 'Evaluate body language, eye contact, responsiveness, attitude.' },
  { id: 'crit-interest', name: 'Interest in and knowledge of the position and organization', category: 'Fit', maxScore: 3, weight: 15, desc: 'Understand motivation, homework done on the firm, and excitement.' },
  { id: 'crit-presentation', name: 'Presentation', category: 'Professionalism', maxScore: 3, weight: 15, desc: 'Promptness, neatness of appearance, business etiquette.' },
  { id: 'crit-resume', name: 'Resume / Application', category: 'Background', maxScore: 3, weight: 15, desc: 'Relevance of background, past projects, achievements, and layout.' },
  { id: 'crit-problem-solving', name: 'Problem Solving Skills', category: 'Technical', maxScore: 3, weight: 25, desc: 'Analytical thinking, approaching complexities, scaling up ideas.' }
];

const MANDATORY_LIKERT_QUESTIONS = [
  { id: 'likert-1', text: 'The applicant has the knowledge, skills, and abilities to perform the duties of this position.' },
  { id: 'likert-2', text: 'The applicant views this position with excitement and enthusiasm.' },
  { id: 'likert-3', text: 'The applicant has the appropriate level of experience necessary for this position.' },
  { id: 'likert-4', text: 'The applicant displayed the ability to participate effectively in a team environment and motivate/lead.' },
  { id: 'likert-5', text: 'The applicant displayed ability to communicate well.' },
  { id: 'likert-6', text: 'The applicant should be included in the final list of recommended applicants.' }
];

const workspaceEntryCard = document.getElementById('workspace-entry');
const mainAppContainer = document.getElementById('main-app-container');
const loginShell = document.getElementById('login-shell');
const workspaceForm = document.getElementById('workspace-form');
const wsNameInput = document.getElementById('ws-name');
const wsPassInput = document.getElementById('ws-pass');
const wsErrorMsg = document.getElementById('ws-error-msg');
const btnTogglePass = document.getElementById('btn-toggle-pass');
const btnWsSubmit = document.getElementById('btn-ws-submit');
const loginAuthPill = document.getElementById('login-auth-pill');
const loginAuthLabel = document.getElementById('login-auth-label');
const loginGreeting = document.getElementById('login-greeting');
const loginTagline = document.getElementById('login-tagline');
const loginSuccessOverlay = document.getElementById('login-success-overlay');
const loginSuccessMsg = document.getElementById('login-success-msg');
const headerWsBadge = document.getElementById('header-ws-badge');
const btnSwitchWs = document.getElementById('btn-switch-ws');
const btnShowWorkspace = document.getElementById('btn-show-workspace');
const navDashboard = document.getElementById('nav-dashboard');
const navFormBuilder = document.getElementById('nav-form-builder');
const navClassAnalytics = document.getElementById('nav-class-analytics');
const navLiveInterview = document.getElementById('nav-live-interview');
const navActiveAssessmentContainer = document.getElementById('nav-active-assessment-container');
const navActiveCandidateName = document.getElementById('nav-active-candidate-name');
const liveTimerLabel = document.getElementById('live-timer');
const tabDashboardContent = document.getElementById('tab-dashboard-content');
const tabFormBuilderContent = document.getElementById('tab-form-builder-content');
const tabLiveInterviewContent = document.getElementById('tab-live-interview-content');
const tabClassAnalyticsContent = document.getElementById('tab-class-analytics-content');
const toastWrapper = document.getElementById('toast-wrapper');
const toastMsg = document.getElementById('toast-msg');
const btnToastDismiss = document.getElementById('btn-toast-dismiss');
const authStatusLabel = document.getElementById('auth-status-label');
const templatesGrid = document.getElementById('templates-grid');
const criteriaInputsContainer = document.getElementById('criteria-inputs-container');
const btnAddCriteria = document.getElementById('btn-add-criteria');
const templateEditorForm = document.getElementById('template-editor-form');
const formBuilderHeaderTitle = document.getElementById('form-builder-header-title');
const cutoffHighSlider = document.getElementById('cutoff-high');
const cutoffLowSlider = document.getElementById('cutoff-low');
const labelCutoffHigh = document.getElementById('label-cutoff-high');
const labelCutoffLow = document.getElementById('label-cutoff-low');
const analyticsSearch = document.getElementById('analytics-search');
const analyticsRoleFilter = document.getElementById('analytics-role-filter');
const candidatesTableBody = document.getElementById('candidates-table-body');
const distributionChartWrapper = document.getElementById('distribution-chart-wrapper');

const showToast = (message, type = 'success') => {
  toastMsg.textContent = message;
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800'
  };
  toastWrapper.className = `mb-4 p-4 rounded-3xl flex items-center justify-between shadow-xs border transition-all ${styles[type] || styles.success}`;
  toastWrapper.classList.remove('hidden');
  setTimeout(() => toastWrapper.classList.add('hidden'), 5000);
};

const NAV_IDLE = 'w-full flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';
const NAV_ACTIVE = 'w-full flex items-center gap-3 rounded-3xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition';
const NAV_LIVE_ACTIVE = 'mt-3 w-full rounded-3xl bg-white px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100';

const switchTab = (tabName) => {
  [navDashboard, navFormBuilder, navClassAnalytics].forEach(el => {
    if (el) el.className = NAV_IDLE;
  });
  if (navLiveInterview && !navActiveAssessmentContainer?.classList.contains('hidden')) {
    navLiveInterview.className = NAV_LIVE_ACTIVE;
  }
  [tabDashboardContent, tabFormBuilderContent, tabLiveInterviewContent, tabClassAnalyticsContent].forEach(el => el?.classList.add('hidden'));

  if (tabName === 'dashboard') {
    navDashboard.className = NAV_ACTIVE;
    tabDashboardContent.classList.remove('hidden');
    renderTemplates();
  } else if (tabName === 'form-builder') {
    navFormBuilder.className = NAV_ACTIVE;
    tabFormBuilderContent.classList.remove('hidden');
    renderBuilderCriteria();
  } else if (tabName === 'live-interview') {
    navLiveInterview.className = NAV_LIVE_ACTIVE;
    tabLiveInterviewContent.classList.remove('hidden');
  } else if (tabName === 'class-analytics') {
    navClassAnalytics.className = NAV_ACTIVE;
    tabClassAnalyticsContent.classList.remove('hidden');
    renderAnalytics();
  }
};

window.switchTab = switchTab;

const resetFormBuilderDefaults = () => {
  document.getElementById('tpl-title').value = '';
  document.getElementById('tpl-role').value = '';
  document.getElementById('tpl-desc').value = '';
  builderCriteria = MANDATORY_CRITERIA_DEFAULTS.map(c => ({ ...c }));
  formBuilderHeaderTitle.textContent = 'Create Interview Evaluation Blueprint';
};

btnToastDismiss.addEventListener('click', () => toastWrapper.classList.add('hidden'));

navDashboard.addEventListener('click', () => switchTab('dashboard'));
navFormBuilder.addEventListener('click', () => {
  editingTemplateId = null;
  resetFormBuilderDefaults();
  switchTab('form-builder');
});
navClassAnalytics.addEventListener('click', () => switchTab('class-analytics'));
navLiveInterview.addEventListener('click', () => switchTab('live-interview'));

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const LOGIN_TAGLINES = [
  'Where great hiring decisions start — together.',
  'Fair scores. Clear feedback. Better hires.',
  'Your team\'s calibration hub, ready when you are.',
  'Less guesswork, more confidence in every interview.'
];

let taglineIndex = 0;

const initLoginUX = () => {
  if (loginGreeting) loginGreeting.textContent = getTimeGreeting();

  if (loginTagline) {
    setInterval(() => {
      taglineIndex = (taglineIndex + 1) % LOGIN_TAGLINES.length;
      loginTagline.style.opacity = '0';
      loginTagline.style.transform = 'translateY(4px)';
      setTimeout(() => {
        loginTagline.textContent = LOGIN_TAGLINES[taglineIndex];
        loginTagline.style.opacity = '1';
        loginTagline.style.transform = 'translateY(0)';
      }, 300);
    }, 5000);
    loginTagline.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }

  wsNameInput?.addEventListener('input', () => {
    const wrap = wsNameInput.closest('.field-input-wrap');
    wrap?.classList.toggle('is-valid', wsNameInput.value.trim().length >= 2);
    wsErrorMsg.classList.add('hidden');
  });

  wsPassInput?.addEventListener('input', () => wsErrorMsg.classList.add('hidden'));
};

const setLoginAuthReady = (ready = true) => {
  if (!loginAuthPill || !loginAuthLabel) return;
  loginAuthPill.classList.toggle('login-auth-pill--pending', !ready);
  loginAuthPill.classList.toggle('login-auth-pill--ready', ready);
  loginAuthLabel.textContent = ready ? 'All set — you can sign in now' : 'Connecting you securely…';
};

const showLoginError = (message) => {
  wsErrorMsg.textContent = message;
  wsErrorMsg.classList.remove('hidden');
  wsErrorMsg.style.animation = 'none';
  void wsErrorMsg.offsetWidth;
  wsErrorMsg.style.animation = '';
  workspaceForm?.classList.add('shake-form');
  setTimeout(() => workspaceForm?.classList.remove('shake-form'), 500);
};

const setSubmitLoading = (loading) => {
  if (!btnWsSubmit) return;
  btnWsSubmit.disabled = loading;
  btnWsSubmit.classList.toggle('is-loading', loading);
  btnWsSubmit.querySelector('.login-submit-loader')?.classList.toggle('hidden', !loading);
};

const playSuccessAndEnter = (wsName, isNew) => {
  if (loginSuccessOverlay && loginSuccessMsg) {
    loginSuccessOverlay.classList.remove('hidden');
    loginSuccessMsg.textContent = isNew
      ? `Setting up "${wsName}" — just a moment…`
      : `Welcome back to "${wsName}"…`;
    loginShell?.classList.add('is-authenticating');
  }

  setTimeout(() => {
    enterWorkspace(wsName);
    loginSuccessOverlay?.classList.add('hidden');
    loginShell?.classList.remove('is-authenticating');
    setSubmitLoading(false);
    mainAppContainer?.classList.add('app-reveal');
    setTimeout(() => mainAppContainer?.classList.remove('app-reveal'), 700);
  }, 1200);
};

initLoginUX();

workspaceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  wsErrorMsg.classList.add('hidden');

  if (!user) {
    showLoginError('Hang tight — we\'re still connecting. Try again in a second.');
    return;
  }

  const wsName = wsNameInput.value.trim();
  const wsPass = wsPassInput.value;

  if (!wsName || !wsPass) {
    showLoginError('We need both a workspace name and password to get you in.');
    return;
  }

  setSubmitLoading(true);

  try {
    const wsRef = doc(db, 'artifacts', app_id, 'public', 'workspaces', wsName);
    const wsSnap = await getDoc(wsRef);
    if (wsSnap.exists()) {
      if (wsSnap.data().password === wsPass) {
        playSuccessAndEnter(wsName, false);
        return;
      }
      showLoginError('That password doesn\'t match this workspace. Double-check and try again.');
    } else {
      await setDoc(wsRef, {
        password: wsPass,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      playSuccessAndEnter(wsName, true);
      return;
    }
  } catch (err) {
    console.error(err);
    showLoginError('Something went wrong on our end. Please try again.');
  }
  setSubmitLoading(false);
});

const enterWorkspace = (wsName) => {
  currentWorkspace = wsName;
  workspaceEntryCard.classList.add('hidden');
  mainAppContainer.classList.remove('hidden');
  mainAppContainer.classList.add('visible');
  loginShell?.classList.add('is-authenticated');
  headerWsBadge.textContent = wsName;
  headerWsBadge.classList.remove('hidden');
  wsNameInput.value = '';
  wsPassInput.value = '';
  wsErrorMsg.classList.add('hidden');
  filterRole = 'All';
  filterQuery = '';
  if (analyticsSearch) analyticsSearch.value = '';
  setupFirestoreSync();
  switchTab('dashboard');
};

btnSwitchWs.addEventListener('click', () => {
  if (activeInterviewTemplate && !window.confirm('Leave workspace? Your active interview will be discarded.')) return;

  cleanupActiveInterview(true);
  currentWorkspace = null;
  workspaceEntryCard.classList.remove('hidden');
  mainAppContainer.classList.add('hidden');
  loginShell?.classList.remove('is-authenticated');
  loginSuccessOverlay?.classList.add('hidden');
  setLoginAuthReady(!!user);
  setSubmitLoading(false);
  wsNameInput?.focus();

  if (unsubscribeTemplates) unsubscribeTemplates();
  if (unsubscribeCandidates) unsubscribeCandidates();

  templates = [];
  candidates = [];
  renderTemplates();
  renderAnalytics();
});

const showWorkspacePanel = () => {
  if (workspaceEntryCard.classList.contains('hidden')) {
    workspaceEntryCard.classList.remove('hidden');
    workspaceEntryCard.classList.add('visible');
  }
  workspaceEntryCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  workspaceEntryCard.classList.add('pulse-panel');
  setTimeout(() => workspaceEntryCard.classList.remove('pulse-panel'), 1200);
  setTimeout(() => wsNameInput?.focus(), 400);
};

btnShowWorkspace.addEventListener('click', showWorkspacePanel);

if (btnTogglePass && wsPassInput) {
  btnTogglePass.addEventListener('click', () => {
    const isPassword = wsPassInput.type === 'password';
    wsPassInput.type = isPassword ? 'text' : 'password';
    btnTogglePass.querySelector('.icon-show')?.classList.toggle('hidden', isPassword);
    btnTogglePass.querySelector('.icon-hide')?.classList.toggle('hidden', !isPassword);
    btnTogglePass.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
}

const padTime = (value) => value.toString().padStart(2, '0');
const getFormattedTime = (seconds) => `${padTime(Math.floor(seconds / 60))}:${padTime(seconds % 60)}`;

const evaluateOverallPerformanceScore = (scores, rubrics, likerts) => {
  if (!rubrics || rubrics.length === 0) return 0;
  let totalWeightedScore = 0;
  let totalWeightUsed = 0;

  rubrics.forEach((crit) => {
    const rating = scores[crit.id];
    if (rating && rating !== 'NA') {
      let ratingPercentage = 0;
      if (rating === 'VS') ratingPercentage = 100;
      else if (rating === 'S') ratingPercentage = 66.6;
      else if (rating === 'NS') ratingPercentage = 33.3;
      const weight = Number(crit.weight || 0);
      totalWeightedScore += ratingPercentage * (weight / 100);
      totalWeightUsed += weight;
    }
  });

  const criteriaFinalScore = totalWeightUsed > 0 ? (totalWeightedScore / totalWeightUsed) * 100 : 100;
  let totalLikertScore = 0;
  let likertsAnswered = 0;
  Object.keys(likerts).forEach((key) => {
    const response = likerts[key];
    if (response) {
      likertsAnswered++;
      if (response === 'Strongly Agree') totalLikertScore += 10;
      else if (response === 'Agree') totalLikertScore += 7;
      else if (response === 'Disagree') totalLikertScore += 3;
    }
  });

  const likertFinalScore = likertsAnswered > 0 ? (totalLikertScore / (likertsAnswered * 10)) * 100 : 100;
  const finalScore = (criteriaFinalScore * 0.6) + (likertFinalScore * 0.4);
  return Math.round(finalScore * 10) / 10;
};

const getPerformerCategory = (score) => {
  if (score >= scoreThresholds.high) return { label: 'Top Performer', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score < scoreThresholds.low) return { label: 'Low Performer', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  return { label: 'Mid Performer', color: 'bg-amber-100 text-amber-800 border-amber-300' };
};

const renderTemplates = () => {
  templatesGrid.innerHTML = '';
  if (templates.length === 0) {
    templatesGrid.innerHTML = `
      <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center col-span-full shadow-xl">
        <h3 class="text-md font-bold text-slate-900 mb-1">No blueprints loaded yet</h3>
        <p class="text-sm text-slate-500 mb-4">Click below to automatically pre-populate the database with the standardized Image evaluation templates.</p>
        <button id="btn-load-defaults-empty" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-full transition shadow-lg">Auto-Generate Standard Rubric Forms</button>
      </div>
    `;
    document.getElementById('btn-load-defaults-empty')?.addEventListener('click', handleLoadMockData);
    return;
  }

  templates.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-3xl border border-slate-200 shadow-xl flex flex-col justify-between';

    let criteriaListHtml = '';
    if (tpl.criteria) {
      tpl.criteria.forEach((c) => {
        criteriaListHtml += `
          <div class="flex justify-between text-xs text-slate-600">
            <span class="truncate max-w-[220px]">✓ ${c.name}</span>
            <span class="text-slate-400 text-[10px] font-mono">Weight: ${c.weight}%</span>
          </div>
        `;
      });
    }

    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-2">
          <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold uppercase">${tpl.role || 'Any Position'}</span>
          <span class="text-xs text-slate-400">${tpl.criteria?.length || 0} Standards</span>
        </div>
        <h4 class="font-bold text-slate-900 text-md">${tpl.title}</h4>
        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${tpl.description}</p>
        <div class="mt-4 space-y-1">
          <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Mandated Criteria Checklist</span>
          ${criteriaListHtml}
        </div>
      </div>
      <div class="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center">
        <div class="flex space-x-1">
          <button class="btn-edit-tpl p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="Edit template fields">✎</button>
          <button class="btn-delete-tpl p-2 text-rose-500 hover:bg-rose-50 rounded-full" title="Delete template">🗑</button>
        </div>
        <button class="btn-launch-interview bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-full transition shadow-sm">Launch Assessment Sheet</button>
      </div>
    `;

    card.querySelector('.btn-edit-tpl').addEventListener('click', () => triggerEditTemplate(tpl));
    card.querySelector('.btn-delete-tpl').addEventListener('click', () => handleDeleteTemplate(tpl.id));
    card.querySelector('.btn-launch-interview').addEventListener('click', () => handleStartInterview(tpl));

    templatesGrid.appendChild(card);
  });
};

const renderBuilderCriteria = () => {
  criteriaInputsContainer.innerHTML = '';
  builderCriteria.forEach((crit, index) => {
    const row = document.createElement('div');
    row.className = 'p-3 bg-slate-50 border border-slate-200 rounded-3xl relative flex flex-col gap-4';
    row.innerHTML = `
      <button type="button" class="btn-remove-builder-row absolute right-3 top-3 text-rose-500 hover:bg-rose-50 p-2 rounded-full">✕</button>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 pr-6">
        <div class="md:col-span-5">
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Assessment Field Name</label>
          <input type="text" class="row-crit-name w-full bg-white border border-slate-300 rounded-2xl p-3 text-sm focus:outline-none" value="${crit.name}" required>
        </div>
        <div class="md:col-span-3">
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Category</label>
          <select class="row-crit-cat w-full bg-white border border-slate-300 rounded-2xl p-3 text-sm focus:outline-none">
            <option value="Communication" ${crit.category === 'Communication' ? 'selected' : ''}>Communication</option>
            <option value="Fit" ${crit.category === 'Fit' ? 'selected' : ''}>Fit</option>
            <option value="Professionalism" ${crit.category === 'Professionalism' ? 'selected' : ''}>Professionalism</option>
            <option value="Background" ${crit.category === 'Background' ? 'selected' : ''}>Background</option>
            <option value="Technical" ${crit.category === 'Technical' ? 'selected' : ''}>Technical</option>
            <option value="Custom Skill" ${crit.category === 'Custom Skill' ? 'selected' : ''}>Custom Skill</option>
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Max (VS Value)</label>
          <input type="number" class="w-full bg-slate-100 border border-slate-200 rounded-2xl p-3 text-sm text-slate-500 focus:outline-none" value="${crit.maxScore || 3}" readonly>
        </div>
        <div class="md:col-span-2">
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Weightage %</label>
          <input type="number" min="1" max="100" class="row-crit-weight w-full bg-white border border-slate-300 rounded-2xl p-3 text-sm focus:outline-none" value="${crit.weight}" required>
        </div>
        <div class="md:col-span-12">
          <input type="text" class="row-crit-desc w-full bg-white border border-slate-300 rounded-2xl p-3 text-sm focus:outline-none" placeholder="Define expectations / help prompts..." value="${crit.desc || ''}">
        </div>
      </div>
    `;

    row.querySelector('.row-crit-name').addEventListener('input', (e) => { builderCriteria[index].name = e.target.value; });
    row.querySelector('.row-crit-cat').addEventListener('change', (e) => { builderCriteria[index].category = e.target.value; });
    row.querySelector('.row-crit-weight').addEventListener('input', (e) => { builderCriteria[index].weight = Number(e.target.value); updateTotalWeightsIndicator(); });
    row.querySelector('.row-crit-desc').addEventListener('input', (e) => { builderCriteria[index].desc = e.target.value; });
    row.querySelector('.btn-remove-builder-row').addEventListener('click', () => {
      builderCriteria.splice(index, 1);
      renderBuilderCriteria();
      updateTotalWeightsIndicator();
    });

    criteriaInputsContainer.appendChild(row);
  });
  updateTotalWeightsIndicator();
};

const updateTotalWeightsIndicator = () => {
  const sum = builderCriteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  const indicator = document.getElementById('criteria-weight-indicator');
  indicator.textContent = `${sum}%`;
  indicator.className = sum === 100 ? 'text-emerald-600 font-extrabold' : 'text-amber-600 font-bold';
};

btnAddCriteria.addEventListener('click', () => {
  builderCriteria.push({ id: `crit-${Date.now()}`, name: '', category: 'Custom Skill', maxScore: 3, weight: 10, desc: '' });
  renderBuilderCriteria();
});

const renderLiveInterviewSheet = () => {
  const criteriaContainer = document.getElementById('live-rating-criteria-container');
  criteriaContainer.innerHTML = '';
  if (!activeInterviewTemplate) return;

  activeInterviewTemplate.criteria.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'p-4 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner flex flex-col gap-4';
    row.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
        <div>
          <h4 class="font-bold text-slate-900 text-xs">${c.name}</h4>
          ${c.desc ? `<p class="text-[10px] text-slate-500 italic mt-1">${c.desc}</p>` : ''}
        </div>
        <div class="flex gap-2 flex-wrap">
          ${['NS', 'S', 'VS', 'NA'].map((rate) => `
            <button type="button" data-rate="${rate}" class="btn-score-select w-11 h-9 rounded-full text-xs font-extrabold border transition ${candidateScores[c.id] === rate ? getRateClass(rate) : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'}">${rate}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Specific comments to support your rating:</label>
        <input type="text" class="input-comment w-full bg-white border border-slate-300 rounded-2xl p-3 text-xs focus:outline-none" placeholder="Add specific rating justifications here..." value="${candidateNotes[c.id] || ''}">
      </div>
    `;

    row.querySelector('.input-comment').addEventListener('input', (e) => { candidateNotes[c.id] = e.target.value; });
    row.querySelectorAll('.btn-score-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedRate = btn.getAttribute('data-rate');
        candidateScores[c.id] = selectedRate;
        row.querySelectorAll('.btn-score-select').forEach((sibling) => {
          sibling.className = 'btn-score-select w-11 h-9 rounded-full text-xs font-extrabold border transition bg-white text-slate-700 hover:bg-slate-100 border-slate-200';
        });
        btn.className = `btn-score-select w-11 h-9 rounded-full text-xs font-extrabold border transition ${getRateClass(selectedRate)}`;
        updateLiveComputedScore();
      });
    });
    criteriaContainer.appendChild(row);
  });

  const likertContainer = document.getElementById('live-likert-questions-container');
  likertContainer.innerHTML = '';
  MANDATORY_LIKERT_QUESTIONS.forEach((q, idx) => {
    const block = document.createElement('div');
    block.className = 'p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-3';
    block.innerHTML = `
      <p class="text-xs font-bold text-slate-800">${idx + 1}. ${q.text}</p>
      <div class="flex flex-wrap gap-2 pt-1">
        ${['Strongly Agree', 'Agree', 'Disagree', 'Could not determine'].map((choice) => `
          <button type="button" data-choice="${choice}" class="btn-likert-choice px-4 py-2 text-xs rounded-full border font-medium transition ${likertResponses[q.id] === choice ? getLikertClass(choice) : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'}">${choice}</button>
        `).join('')}
      </div>
    `;

    block.querySelectorAll('.btn-likert-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedChoice = btn.getAttribute('data-choice');
        likertResponses[q.id] = selectedChoice;
        block.querySelectorAll('.btn-likert-choice').forEach((sibling) => {
          sibling.className = 'btn-likert-choice px-4 py-2 text-xs rounded-full border font-medium transition bg-white border-slate-200 hover:bg-slate-100 text-slate-600';
        });
        btn.className = `btn-likert-choice px-4 py-2 text-xs rounded-full border font-medium transition ${getLikertClass(selectedChoice)}`;
        updateLiveComputedScore();
      });
    });
    likertContainer.appendChild(block);
  });
  updateLiveComputedScore();
};

const getRateClass = (rate) => {
  if (rate === 'VS') return 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
  if (rate === 'S') return 'bg-indigo-600 text-white border-indigo-700 shadow-sm';
  if (rate === 'NS') return 'bg-rose-600 text-white border-rose-700 shadow-sm';
  return 'bg-slate-700 text-white border-slate-800 shadow-sm';
};

const getLikertClass = (choice) => {
  if (choice === 'Strongly Agree') return 'bg-emerald-100 border-emerald-500 text-emerald-800 font-bold';
  if (choice === 'Agree') return 'bg-indigo-100 border-indigo-500 text-indigo-800 font-bold';
  if (choice === 'Disagree') return 'bg-rose-100 border-rose-500 text-rose-800 font-bold';
  return 'bg-slate-200 border-slate-500 text-slate-800 font-bold';
};

const updateLiveComputedScore = () => {
  const score = evaluateOverallPerformanceScore(candidateScores, activeInterviewTemplate.criteria, likertResponses);
  document.getElementById('live-computed-score-badge').textContent = `${score}%`;
};

const renderAnalytics = () => {
  const uniqueRoles = ['All', ...new Set(candidates.map((c) => c.role).filter(Boolean))];
  analyticsRoleFilter.innerHTML = '';
  uniqueRoles.forEach((role) => {
    analyticsRoleFilter.innerHTML += `<option value="${role}" ${filterRole === role ? 'selected' : ''}>${role}</option>`;
  });

  const filtered = candidates.filter((cand) => {
    const matchesRole = filterRole === 'All' || cand.role === filterRole;
    const matchesSearch = cand.name.toLowerCase().includes(filterQuery.toLowerCase()) || cand.interviewer.toLowerCase().includes(filterQuery.toLowerCase()) || cand.templateTitle.toLowerCase().includes(filterQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const topT = filtered.filter((c) => c.calculatedScore >= scoreThresholds.high);
  const midT = filtered.filter((c) => c.calculatedScore >= scoreThresholds.low && c.calculatedScore < scoreThresholds.high);
  const lowT = filtered.filter((c) => c.calculatedScore < scoreThresholds.low);

  renderDistributionChart(filtered, topT, midT, lowT);
  candidatesTableBody.innerHTML = '';

  if (filtered.length === 0) {
    candidatesTableBody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-xs text-slate-400">No matching search entries found.</td></tr>`;
    return;
  }

  filtered.forEach((cand) => {
    const category = getPerformerCategory(cand.calculatedScore);
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50 transition border-b border-slate-100';
    row.innerHTML = `
      <td class="p-4">
        <span class="font-bold text-slate-900 block">${cand.name}</span>
        <span class="text-[10px] text-slate-400">${cand.role}</span>
      </td>
      <td class="p-4">
        <span class="font-medium text-slate-800 block">${cand.interviewer}</span>
        <span class="text-[10px] text-slate-400">${cand.date || 'No Date'}</span>
      </td>
      <td class="p-4 font-mono font-black text-slate-950 text-sm">${cand.calculatedScore}%</td>
      <td class="p-4"><span class="inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${category.color}">${category.label}</span></td>
      <td class="p-4 max-w-[150px] truncate" title="${cand.strengths || '-'}">${cand.strengths || '-'}</td>
      <td class="p-4 max-w-[150px] truncate" title="${cand.weaknesses || '-'}">${cand.weaknesses || '-'}</td>
      <td class="p-4 text-right space-x-1 whitespace-nowrap">
        <button class="btn-copy-report p-2 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100" title="Copy scorecard report to clipboard">📋</button>
        <button class="btn-delete-cand p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100" title="Remove Evaluation permanently">🗑</button>
      </td>
    `;

    row.querySelector('.btn-copy-report').addEventListener('click', () => {
      const text = `Candidate Report: ${cand.name}\nOverall Grade: ${cand.calculatedScore}%\nVerdict: ${category.label}\nStrengths: ${cand.strengths}\nWeaknesses: ${cand.weaknesses}\nAdditional Comments: ${cand.overallFeedback}`;
      navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : document.execCommand('copy');
      showToast('Detailed scorecard report copied to clipboard!');
    });

    row.querySelector('.btn-delete-cand').addEventListener('click', () => { handleDeleteCandidate(cand.id); });
    candidatesTableBody.appendChild(row);
  });
};

const renderDistributionChart = (filteredList, topT, midT, lowT) => {
  distributionChartWrapper.innerHTML = '';
  if (filteredList.length === 0) {
    distributionChartWrapper.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No calibrated candidates found inside the directory database.</p>`;
    return;
  }

  const total = filteredList.length;
  const topPct = Math.round((topT.length / total) * 100);
  const midPct = Math.round((midT.length / total) * 100);
  const lowPct = Math.round((lowT.length / total) * 100);
  distributionChartWrapper.innerHTML = `
    <div class="h-8 w-full bg-slate-100 rounded-3xl overflow-hidden flex mb-4">
      ${topT.length > 0 ? `<div style="width: ${topPct}%" class="bg-emerald-500 text-white font-extrabold text-[10px] flex items-center justify-center transition-all">Top: ${topPct}%</div>` : ''}
      ${midT.length > 0 ? `<div style="width: ${midPct}%" class="bg-amber-500 text-white font-extrabold text-[10px] flex items-center justify-center transition-all">Mid: ${midPct}%</div>` : ''}
      ${lowT.length > 0 ? `<div style="width: ${lowPct}%" class="bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center transition-all">Low: ${lowPct}%</div>` : ''}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-3xl text-emerald-800 text-xs font-bold">⭐ Top tier (${topT.length} candidates)</div>
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-3xl text-amber-800 text-xs font-bold">⚖️ Mid tier (${midT.length} candidates)</div>
      <div class="p-3 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-xs font-bold">⚠️ Low tier (${lowT.length} candidates)</div>
    </div>
  `;
};

const triggerEditTemplate = (template) => {
  editingTemplateId = template.id;
  document.getElementById('tpl-title').value = template.title;
  document.getElementById('tpl-role').value = template.role || '';
  document.getElementById('tpl-desc').value = template.description || '';
  builderCriteria = template.criteria || [...MANDATORY_CRITERIA_DEFAULTS];
  formBuilderHeaderTitle.textContent = 'Configure Existing Form Rubrics';
  switchTab('form-builder');
};

const handleDeleteTemplate = async (id) => {
  if (!window.confirm('Delete this form template permanently?')) return;
  try {
    await deleteDoc(doc(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'templates', id));
    showToast('Template removed successfully.');
  } catch (err) {
    showToast('Deletion error.', 'error');
  }
};

templateEditorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user) {
    showToast('Syncing auth session, please wait.', 'error');
    return;
  }

  const templateData = {
    title: document.getElementById('tpl-title').value,
    description: document.getElementById('tpl-desc').value,
    role: document.getElementById('tpl-role').value,
    criteria: builderCriteria,
    updatedAt: new Date().toISOString(),
    creator: user?.uid || 'anonymous'
  };

  try {
    if (editingTemplateId) {
      const docRef = doc(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'templates', editingTemplateId);
      await updateDoc(docRef, templateData);
      showToast('Rubric form template updated successfully!');
    } else {
      const collectionRef = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'templates');
      await addDoc(collectionRef, templateData);
      showToast('Dynamic form template published!');
    }
    switchTab('dashboard');
  } catch (err) {
    console.error(err);
    showToast('Failed to save templates.', 'error');
  }
});

const handleStartInterview = (template) => {
  activeInterviewTemplate = template;
  document.getElementById('candidate-name').value = '';
  document.getElementById('candidate-role').value = template.role || '';
  document.getElementById('interviewer-name').value = '';
  document.getElementById('date-of-interview').value = new Date().toISOString().split('T')[0];

  candidateScores = {};
  candidateNotes = {};
  template.criteria.forEach((c) => {
    candidateScores[c.id] = 'S';
    candidateNotes[c.id] = '';
  });

  likertResponses = {
    'likert-1': 'Agree', 'likert-2': 'Agree', 'likert-3': 'Agree', 'likert-4': 'Agree', 'likert-5': 'Agree', 'likert-6': 'Agree'
  };

  document.getElementById('candidate-strengths').value = '';
  document.getElementById('candidate-weaknesses').value = '';
  document.getElementById('overall-feedback').value = '';
  interviewDuration = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    interviewDuration++;
    const formatted = getFormattedTime(interviewDuration);
    liveTimerLabel.textContent = formatted;
    document.querySelectorAll('.live-duration-text').forEach((el) => { el.textContent = formatted; });
  }, 1000);

  navActiveCandidateName.textContent = 'Candidate Interview';
  navActiveAssessmentContainer.classList.remove('hidden');
  renderLiveInterviewSheet();
  switchTab('live-interview');
};

document.getElementById('candidate-name').addEventListener('input', (event) => {
  navActiveCandidateName.textContent = event.target.value || 'Candidate Interview';
});

document.getElementById('btn-cancel-interview').addEventListener('click', () => {
  if (window.confirm('Abandon current assessment? This wipes live evaluations.')) cleanupActiveInterview();
});

const cleanupActiveInterview = () => {
  clearInterval(timerInterval);
  activeInterviewTemplate = null;
  navActiveAssessmentContainer.classList.add('hidden');
  switchTab('dashboard');
};

document.getElementById('live-interview-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user) {
    showToast('Connection pending. Please try again in a few moments.', 'error');
    return;
  }

  const calculatedScore = evaluateOverallPerformanceScore(candidateScores, activeInterviewTemplate.criteria, likertResponses);
  const candidateData = {
    name: document.getElementById('candidate-name').value,
    role: document.getElementById('candidate-role').value || activeInterviewTemplate.role || 'General Profile',
    interviewer: document.getElementById('interviewer-name').value || 'Anonymous Interviewer',
    date: document.getElementById('date-of-interview').value,
    templateTitle: activeInterviewTemplate.title,
    scores: candidateScores,
    notes: candidateNotes,
    likertAnswers: likertResponses,
    strengths: document.getElementById('candidate-strengths').value,
    weaknesses: document.getElementById('candidate-weaknesses').value,
    overallFeedback: document.getElementById('overall-feedback').value,
    durationSeconds: interviewDuration,
    calculatedScore,
    evaluatedAt: new Date().toISOString()
  };

  try {
    const candidatesCollection = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'candidates');
    await addDoc(candidatesCollection, candidateData);
    showToast(`${candidateData.name} evaluated and calibrated successfully!`);
    cleanupActiveInterview();
    switchTab('class-analytics');
  } catch (err) {
    console.error(err);
    showToast('Error saving candidate evaluation.', 'error');
  }
});

const handleDeleteCandidate = async (id) => {
  if (!window.confirm('Remove candidate trial evaluation report permanently?')) return;
  try {
    await deleteDoc(doc(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'candidates', id));
    showToast('Evaluation report deleted.');
  } catch (err) {
    showToast('Could not delete report.', 'error');
  }
};

cutoffHighSlider.addEventListener('input', (event) => {
  scoreThresholds.high = Number(event.target.value);
  labelCutoffHigh.textContent = `${scoreThresholds.high}%`;
  renderAnalytics();
});

cutoffLowSlider.addEventListener('input', (event) => {
  scoreThresholds.low = Number(event.target.value);
  labelCutoffLow.textContent = `${scoreThresholds.low}%`;
  renderAnalytics();
});

analyticsSearch.addEventListener('input', (event) => {
  filterQuery = event.target.value;
  renderAnalytics();
});

analyticsRoleFilter.addEventListener('change', (event) => {
  filterRole = event.target.value;
  renderAnalytics();
});

const handleLoadMockData = async () => {
  if (!user) return;
  try {
    const templateCollectionRef = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'templates');
    const defaultForm = {
      title: 'Standard Mock Interview Evaluation Form',
      description: 'Official structured rubric containing both Image 1 and Image 2 standards: NS/S/VS checklist ratings, Likert indicator checklists, Strengths/Weaknesses fields, and overall calibration metric outputs.',
      role: 'Software Developer Candidate',
      criteria: [...MANDATORY_CRITERIA_DEFAULTS],
      updatedAt: new Date().toISOString(),
      creator: 'system'
    };
    await addDoc(templateCollectionRef, defaultForm);
    const candidatesCollectionRef = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'candidates');
    const mockCandidates = [
      {
        name: 'Rohan Varma',
        role: 'Software Developer Candidate',
        interviewer: 'Mr. Alex Mercer',
        date: new Date(Date.now() - 3600000 * 24).toISOString().split('T')[0],
        templateTitle: 'Standard Mock Interview Evaluation Form',
        scores: { 'crit-comm-verbal': 'VS', 'crit-comm-nonverbal': 'VS', 'crit-interest': 'S', 'crit-presentation': 'VS', 'crit-resume': 'S', 'crit-problem-solving': 'VS' },
        notes: { 'crit-comm-verbal': 'Spoke cleanly and persuasively.', 'crit-problem-solving': 'Solved the architectural database optimization cleanly.' },
        likertAnswers: { 'likert-1': 'Strongly Agree', 'likert-2': 'Strongly Agree', 'likert-3': 'Agree', 'likert-4': 'Strongly Agree', 'likert-5': 'Strongly Agree', 'likert-6': 'Strongly Agree' },
        strengths: 'Outstanding problem solving, rapid delivery of clean algorithms under pressure, and crisp verbal presentation.',
        weaknesses: 'Slightly passive on asking about internal corporate culture segments.',
        overallFeedback: 'Stellar performance overall, highly recommended. Possesses precise skills matched for the team leader position.',
        durationSeconds: 2450,
        calculatedScore: 92.5,
        evaluatedAt: new Date().toISOString()
      },
      {
        name: 'Simran Kaur',
        role: 'Software Developer Candidate',
        interviewer: 'Ms. Elena Rostova',
        date: new Date().toISOString().split('T')[0],
        templateTitle: 'Standard Mock Interview Evaluation Form',
        scores: { 'crit-comm-verbal': 'S', 'crit-comm-nonverbal': 'S', 'crit-interest': 'NS', 'crit-presentation': 'S', 'crit-resume': 'S', 'crit-problem-solving': 'S' },
        notes: { 'crit-interest': 'Had low awareness about current product lines.' },
        likertAnswers: { 'likert-1': 'Agree', 'likert-2': 'Disagree', 'likert-3': 'Agree', 'likert-4': 'Agree', 'likert-5': 'Agree', 'likert-6': 'Agree' },
        strengths: 'Has valid technical baseline, comfortable with medium difficulty coding questions.',
        weaknesses: 'Lacks core organization context and product excitement.',
        overallFeedback: 'Good solid developer, but requires excitement calibration and background review.',
        durationSeconds: 1800,
        calculatedScore: 65.0,
        evaluatedAt: new Date().toISOString()
      },
      {
        name: 'Daniel Craig',
        role: 'Software Developer Candidate',
        interviewer: 'Mr. Alex Mercer',
        date: new Date(Date.now() - 3600000 * 48).toISOString().split('T')[0],
        templateTitle: 'Standard Mock Interview Evaluation Form',
        scores: { 'crit-comm-verbal': 'NS', 'crit-comm-nonverbal': 'NS', 'crit-interest': 'NS', 'crit-presentation': 'NS', 'crit-resume': 'NS', 'crit-problem-solving': 'NS' },
        notes: { 'crit-problem-solving': 'Could not outline high scale layout requirements.' },
        likertAnswers: { 'likert-1': 'Disagree', 'likert-2': 'Disagree', 'likert-3': 'Disagree', 'likert-4': 'Could not determine', 'likert-5': 'Disagree', 'likert-6': 'Disagree' },
        strengths: 'Average theoretical definitions.',
        weaknesses: 'Significant gaps in coding execution, high level design, and professional etiquette.',
        overallFeedback: 'Does not meet the baseline criteria for position title. Significant remediation recommended.',
        durationSeconds: 1550,
        calculatedScore: 32.0,
        evaluatedAt: new Date().toISOString()
      }
    ];

    for (const cand of mockCandidates) {
      await addDoc(candidatesCollectionRef, cand);
    }
    showToast('Standard Mock Evaluation Template & Candidates populated successfully!');
  } catch (err) {
    console.error(err);
    showToast('Error populating defaults.', 'error');
  }
};

btnMockLoader.addEventListener('click', handleLoadMockData);

const initAuth = async () => {
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    } else {
      await signInAnonymously(auth);
    }
  } catch (err) {
    console.error('Auth initialization failure: ', err);
    showToast('Connected in offline preview status. Data is temporary.', 'info');
    user = { uid: 'anonymous-local-dev-user' };
    authStatusLabel.textContent = 'Offline Status';
    setLoginAuthReady(true);
    setupFirestoreSync();
  }
};

initAuth();

onAuthStateChanged(auth, (u) => {
  if (u) {
    user = u;
    authStatusLabel.textContent = 'Database Active';
    btnMockLoader.classList.remove('hidden');
    setLoginAuthReady(true);
    setupFirestoreSync();
  } else {
    user = null;
    authStatusLabel.textContent = 'Unauthenticated';
    setLoginAuthReady(false);
  }
});

let unsubscribeTemplates = null;
let unsubscribeCandidates = null;

const setupFirestoreSync = () => {
  if (!currentWorkspace) return;

  const templatesCollection = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'templates');
  const candidatesCollection = collection(db, 'artifacts', app_id, 'public', 'workspaces', currentWorkspace, 'candidates');

  if (unsubscribeTemplates) unsubscribeTemplates();
  if (unsubscribeCandidates) unsubscribeCandidates();

  unsubscribeTemplates = onSnapshot(templatesCollection, (snapshot) => {
    templates = [];
    snapshot.forEach((doc) => templates.push({ id: doc.id, ...doc.data() }));
    renderTemplates();
  }, (error) => {
    console.error('Templates snapshot fetch error:', error);
  });

  unsubscribeCandidates = onSnapshot(candidatesCollection, (snapshot) => {
    candidates = [];
    snapshot.forEach((doc) => candidates.push({ id: doc.id, ...doc.data() }));
    renderAnalytics();
  }, (error) => {
    console.error('Candidates snapshot fetch error:', error);
  });
};
