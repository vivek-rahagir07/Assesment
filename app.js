import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, getDoc, setDoc, getDocs, query, where, enableMultiTabIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported by this browser');
  }
});

let user = null;
let currentWorkspace = null;
let wsMode = null; // 'enter' | 'create'
let templates = [];
let candidates = [];
let activeInterviewTemplate = null;
let activePanelId = null;
let activePanel = null;
let activePanelCandidateId = null;
let activePanelCandidate = null;
let panelCandidates = [];
let panelScorecards = [];
let panelTemplateForCreate = null;
let unsubscribePanelCandidates = null;
let unsubscribePanelScorecards = null;
let unsubscribePanelDoc = null;
let panelJoinAutoEnter = false;
let panelCandidateSearchQuery = '';
let pendingImportRows = [];
let pendingImportFileName = '';
let importModalContext = 'panel';
let soloRosterQueue = [];
let soloRosterSearchQuery = '';
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
const btnWsSubmitText = document.getElementById('btn-ws-submit-text');
const loginAuthPill = document.getElementById('login-auth-pill');
const loginAuthLabel = document.getElementById('login-auth-label');
const loginGreeting = document.getElementById('login-greeting');
const wsTypewriterWord = document.getElementById('ws-typewriter-word');
const loginSuccessOverlay = document.getElementById('login-success-overlay');
const loginSuccessMsg = document.getElementById('login-success-msg');
const headerWsBadge = document.getElementById('header-ws-badge');
const btnSwitchWs = document.getElementById('btn-switch-ws');
const btnShowWorkspace = document.getElementById('btn-show-workspace');
const btnShareWs = document.getElementById('btn-share-ws');
const landingStep = document.getElementById('landing-step');
const formStep = document.getElementById('form-step');
const btnModeEnter = document.getElementById('btn-mode-enter');
const btnModeCreate = document.getElementById('btn-mode-create');
const btnBackToLanding = document.getElementById('btn-back-to-landing');
const formStepTitle = document.getElementById('form-step-title');
const formStepSubtitle = document.getElementById('form-step-subtitle');
const formStepEyebrow = document.getElementById('form-step-eyebrow');
const formStepFootnote = document.getElementById('form-step-footnote');
const navDashboard = document.getElementById('nav-dashboard');
const navFormBuilder = document.getElementById('nav-form-builder');
const navClassAnalytics = document.getElementById('nav-class-analytics');
const navLiveInterview = document.getElementById('nav-live-interview');
const navActiveAssessmentContainer = document.getElementById('nav-active-assessment-container');
const navActiveCandidateName = document.getElementById('nav-active-candidate-name');
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
const btnToggleDashboard = document.getElementById('btn-toggle-dashboard');
const btnCloseDashboard = document.getElementById('btn-close-dashboard');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportExcel = document.getElementById('btn-export-excel');
const analyticsDashboardPanel = document.getElementById('analytics-dashboard-panel');
const dashboardStatsGrid = document.getElementById('dashboard-stats-grid');
const candidateDetailModal = document.getElementById('candidate-detail-modal');
const candidateDetailBody = document.getElementById('candidate-detail-body');
const candidateDetailTitle = document.getElementById('candidate-detail-title');
const candidateDetailSubtitle = document.getElementById('candidate-detail-subtitle');
const btnCloseCandidateModal = document.getElementById('btn-close-candidate-modal');
const candidateDetailBackdrop = document.getElementById('candidate-detail-backdrop');
const btnCandidatePrint = document.getElementById('btn-candidate-print');
const btnCandidatePdf = document.getElementById('btn-candidate-pdf');
const btnCandidateEditToggle = document.getElementById('btn-candidate-edit-toggle');
const btnCandidateSave = document.getElementById('btn-candidate-save');
const scorecardPrintRoot = document.getElementById('scorecard-print-root');
const draftResumeBanner = document.getElementById('draft-resume-banner');
const draftResumeSummary = document.getElementById('draft-resume-summary');
const draftResumeMeta = document.getElementById('draft-resume-meta');
const btnResumeDraft = document.getElementById('btn-resume-draft');
const btnDiscardDraft = document.getElementById('btn-discard-draft');

let chartInstances = {};
let dashboardVisible = false;
let viewingCandidate = null;
let candidateDetailEditMode = false;
let cachedDraft = null;
let draftSaveTimer = null;
let settingsSaveTimer = null;
let liveInterviewAutosaveBound = false;

const SCRIPT_URLS = {
  chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
  html2pdf: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
};

const scriptPromises = {};

const loadScript = (src) => {
  if (scriptPromises[src]) return scriptPromises[src];
  scriptPromises[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromises[src];
};

const isMobileDevice = () => window.matchMedia('(max-width: 768px)').matches
  || window.matchMedia('(hover: none) and (pointer: coarse)').matches;

let analyticsRenderTimer = null;
const scheduleRenderAnalytics = () => {
  clearTimeout(analyticsRenderTimer);
  analyticsRenderTimer = setTimeout(renderAnalytics, isMobileDevice() ? 280 : 120);
};

const showToast = (message, type = 'success', persist = false) => {
  toastMsg.textContent = message;
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800'
  };
  toastWrapper.className = `mb-4 p-4 rounded-3xl flex items-center justify-between shadow-xs border transition-all ${styles[type] || styles.success}`;
  toastWrapper.classList.remove('hidden');
  if (!persist) {
    setTimeout(() => toastWrapper.classList.add('hidden'), 5000);
  }
};

const NAV_IDLE = 'w-full flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50';
const NAV_ACTIVE = 'w-full flex items-center gap-3 rounded-3xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition';
const NAV_LIVE_ACTIVE = 'mt-3 w-full rounded-3xl bg-white px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-100';

const evaluatorNotepadAside = document.getElementById('evaluator-notepad-aside');

const setLiveInterviewLayout = (active) => {
  loginShell?.classList.toggle('live-interview-focus', active);
  evaluatorNotepadAside?.classList.toggle('hidden', !active);
};

const switchTab = (tabName) => {
  [navDashboard, navFormBuilder, navClassAnalytics].forEach(el => {
    if (el) el.className = NAV_IDLE;
  });
  if (navLiveInterview && !navActiveAssessmentContainer?.classList.contains('hidden')) {
    navLiveInterview.className = NAV_LIVE_ACTIVE;
  }
  [tabDashboardContent, tabFormBuilderContent, tabLiveInterviewContent, tabClassAnalyticsContent].forEach(el => el?.classList.add('hidden'));

  if (tabName === 'dashboard') {
    setLiveInterviewLayout(false);
    navDashboard.className = NAV_ACTIVE;
    tabDashboardContent.classList.remove('hidden');
    renderTemplates();
  } else if (tabName === 'form-builder') {
    setLiveInterviewLayout(false);
    navFormBuilder.className = NAV_ACTIVE;
    tabFormBuilderContent.classList.remove('hidden');
    renderBuilderCriteria();
  } else if (tabName === 'live-interview') {
    setLiveInterviewLayout(true);
    navLiveInterview.className = NAV_LIVE_ACTIVE;
    tabLiveInterviewContent.classList.remove('hidden');
  } else if (tabName === 'class-analytics') {
    setLiveInterviewLayout(false);
    navClassAnalytics.className = NAV_ACTIVE;
    tabClassAnalyticsContent.classList.remove('hidden');
    renderAnalytics();
  } else {
    setLiveInterviewLayout(false);
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

const WS_TYPEWRITER_WORDS = [
  'Precision grading',
  'Unbiased decisions',
  'Talent intelligence',
  'Perfect calibration'
];

let wsTypewriterIndex = 0;
let wsTypewriterRunning = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const formatWsTypewriterPhrase = (phrase) => phrase;

const typePhraseIn = async (el, text, speed = 42) => {
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text.charAt(i);
    await sleep(speed);
  }
};

const typePhraseOut = async (el, speed = 28) => {
  let text = el.textContent;
  while (text.length > 0) {
    text = text.slice(0, -1);
    el.textContent = text;
    await sleep(speed);
  }
};

const initWsTypewriter = () => {
  if (!wsTypewriterWord || wsTypewriterRunning) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    wsTypewriterWord.textContent = WS_TYPEWRITER_WORDS[0];
    return;
  }

  wsTypewriterRunning = true;

  const run = async () => {
    await sleep(400);
    while (true) {
      if (currentWorkspace) {
        await sleep(1000);
        continue;
      }
      const phrase = formatWsTypewriterPhrase(WS_TYPEWRITER_WORDS[wsTypewriterIndex]);
      await typePhraseIn(wsTypewriterWord, phrase);
      await sleep(2400);
      await typePhraseOut(wsTypewriterWord);
      await sleep(350);
      wsTypewriterIndex = (wsTypewriterIndex + 1) % WS_TYPEWRITER_WORDS.length;
    }
  };

  wsTypewriterWord.textContent = '';
  run();
};

const initLoginUX = () => {
  initWsTypewriter();

  wsNameInput?.addEventListener('input', () => {
    const wrap = wsNameInput.closest('.field-input-wrap');
    wrap?.classList.toggle('is-valid', wsNameInput.value.trim().length >= 2);
    wsErrorMsg.classList.add('hidden');
  });

  wsPassInput?.addEventListener('input', () => wsErrorMsg.classList.add('hidden'));

  const urlParams = new URLSearchParams(window.location.search);
  const wsParam = urlParams.get('workspace');
  if (wsParam && wsNameInput) {
    // Shared link — auto-select Enter mode and pre-fill workspace name
    setTimeout(() => {
      showFormStep('enter');
      setTimeout(() => {
        wsNameInput.value = wsParam;
        const wrap = wsNameInput.closest('.field-input-wrap');
        wrap?.classList.add('is-valid');
        wsPassInput?.focus();
      }, 250);
    }, 400);
  }
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

// ── Landing step: mode selection ──
const wsNameLabel   = document.getElementById('ws-name-label');
const wsPassLabel   = document.getElementById('ws-pass-label');

const showFormStep = (mode) => {
  wsMode = mode;

  if (mode === 'create') {
    formStepEyebrow.textContent  = 'New workspace';
    formStepTitle.textContent    = 'Create your workspace';
    formStepSubtitle.textContent = 'Choose a unique name and a strong password. Your workspace will be created instantly.';
    if (btnWsSubmitText)  btnWsSubmitText.textContent  = 'Create workspace';
    if (formStepFootnote) formStepFootnote.textContent = 'Only people with your password can join this workspace.';
    if (wsNameLabel) wsNameLabel.textContent = 'Choose a workspace name';
    if (wsPassLabel) wsPassLabel.textContent = 'Set a password';
    wsNameInput.placeholder = 'e.g. Engineering_Q3';
    wsPassInput.placeholder = 'Choose something memorable';
    wsPassInput.setAttribute('autocomplete', 'new-password');
  } else {
    formStepEyebrow.textContent  = 'Your workspace';
    formStepTitle.textContent    = 'Sign in to your workspace';
    formStepSubtitle.textContent = 'Enter your workspace name and password to continue.';
    if (btnWsSubmitText)  btnWsSubmitText.textContent  = 'Enter workspace';
    if (formStepFootnote) formStepFootnote.textContent = 'Only people with the workspace password can access it.';
    if (wsNameLabel) wsNameLabel.textContent = 'Workspace name';
    if (wsPassLabel) wsPassLabel.textContent = 'Password';
    wsNameInput.placeholder = 'e.g. Engineering_Q3';
    wsPassInput.placeholder = 'Your workspace password';
    wsPassInput.setAttribute('autocomplete', 'current-password');
  }

  // Animate out landing, animate in form
  landingStep.classList.add('step-exit');
  setTimeout(() => {
    landingStep.classList.add('hidden');
    landingStep.classList.remove('step-exit');
    formStep.classList.remove('hidden');
    formStep.classList.add('step-enter');
    setTimeout(() => formStep.classList.remove('step-enter'), 350);
    wsNameInput?.focus();
  }, 200);
};

const showLandingStep = () => {
  wsMode = null;
  formStep.classList.add('hidden');
  landingStep.classList.remove('hidden');
  wsNameInput.value = '';
  wsPassInput.value = '';
  wsErrorMsg.classList.add('hidden');
  const wrap = wsNameInput.closest('.field-input-wrap');
  wrap?.classList.remove('is-valid');
};

if (btnModeEnter) btnModeEnter.addEventListener('click', () => showFormStep('enter'));
if (btnModeCreate) btnModeCreate.addEventListener('click', () => showFormStep('create'));
if (btnBackToLanding) btnBackToLanding.addEventListener('click', showLandingStep);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginUX);
} else {
  initLoginUX();
}

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
    showLoginError('We need both a workspace name and password to continue.');
    return;
  }

  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(wsName)) {
    showLoginError('Workspace name: 2–64 characters, letters, numbers, _ and - only.');
    return;
  }

  setSubmitLoading(true);

  try {
    const wsRef = doc(db, 'artifacts', app_id, 'workspaces', wsName);
    const wsSnap = await getDoc(wsRef);

    if (wsMode === 'enter') {
      // ENTER mode: workspace must exist
      if (!wsSnap.exists()) {
        showLoginError('No workspace found with that name. Check the name or create a new one.');
        setSubmitLoading(false);
        return;
      }
      if (wsSnap.data().password !== wsPass) {
        showLoginError('Incorrect password for this workspace. Please try again.');
        setSubmitLoading(false);
        return;
      }
      playSuccessAndEnter(wsName, false);

    } else if (wsMode === 'create') {
      // CREATE mode: workspace must NOT exist
      if (wsSnap.exists()) {
        showLoginError('A workspace with this name already exists. Try a different name or enter the existing one.');
        setSubmitLoading(false);
        return;
      }
      await setDoc(wsRef, {
        password: wsPass,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      playSuccessAndEnter(wsName, true);

    } else {
      // Fallback: shouldn't happen, go back to landing
      showLandingStep();
      setSubmitLoading(false);
    }

  } catch (err) {
    console.error(err);
    showLoginError(`Error: ${err.message}`);
    setSubmitLoading(false);
  }
});

const enterWorkspace = (wsName) => {
  currentWorkspace = wsName;
  workspaceEntryCard.classList.add('hidden');
  mainAppContainer.classList.remove('hidden');
  mainAppContainer.classList.add('visible');
  
  // Force reflow to ensure visibility
  void mainAppContainer.offsetHeight;
  
  loginShell?.classList.add('is-authenticated');
  headerWsBadge.textContent = wsName;
  headerWsBadge.classList.remove('hidden');
  if (btnShareWs) {
    btnShareWs.classList.remove('hidden');
    btnShareWs.classList.add('flex');
  }
  wsNameInput.value = '';
  wsPassInput.value = '';
  wsErrorMsg.classList.add('hidden');
  filterRole = 'All';
  filterQuery = '';
  if (analyticsSearch) analyticsSearch.value = '';
  dashboardVisible = false;
  analyticsDashboardPanel?.classList.add('hidden');
  
  try {
    Object.keys(chartInstances).forEach(destroyChart);
  } catch (e) {
    console.error('Error destroying charts:', e);
  }
  
  legacyCleanupDone = false;
  
  try {
    loadWorkspaceSettings();
    loadInterviewDraft().then(() => renderDraftBanner());
    setupFirestoreSync();

    const urlParams = new URLSearchParams(window.location.search);
    const shortcut = urlParams.get('shortcut');
    if (shortcut === 'analytics') {
      switchTab('class-analytics');
    } else {
      switchTab('dashboard');
    }

    const panelCodeParam = urlParams.get('panel');
    if (panelCodeParam) {
      setTimeout(() => joinPanelByCode(panelCodeParam), 400);
    }
  } catch (e) {
    console.error('Error loading workspace:', e);
  }
};

btnSwitchWs.addEventListener('click', () => {
  if (activeInterviewTemplate && !window.confirm('Leave workspace? Your active interview will be discarded.')) return;

  cleanupActiveInterview(true);
  teardownPanelListeners();
  currentWorkspace = null;
  wsMode = null;
  workspaceEntryCard.classList.remove('hidden');
  mainAppContainer.classList.add('hidden');
  loginShell?.classList.remove('is-authenticated');
  if (btnShareWs) {
    btnShareWs.classList.add('hidden');
    btnShareWs.classList.remove('flex');
  }
  loginSuccessOverlay?.classList.add('hidden');
  setLoginAuthReady(!!user);
  setSubmitLoading(false);

  // Return to landing step
  showLandingStep();

  if (unsubscribeTemplates) unsubscribeTemplates();
  if (unsubscribeCandidates) unsubscribeCandidates();

  templates = [];
  candidates = [];
  cachedDraft = null;
  legacyCleanupDone = false;
  scoreThresholds = { high: 80, low: 50 };
  applyScoreThresholdsToUI();
  dashboardVisible = false;
  analyticsDashboardPanel?.classList.add('hidden');
  Object.keys(chartInstances).forEach(destroyChart);
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

const computeScoreBreakdown = (scores, rubrics, likerts) => {
  if (!rubrics || rubrics.length === 0) {
    return { criteriaScore: 0, likertScore: 0, finalScore: 0, criteriaWeight: 0.6, likertWeight: 0.4, likertsAnswered: 0 };
  }

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

  const criteriaScore = totalWeightUsed > 0 ? Math.round((totalWeightedScore / totalWeightUsed) * 1000) / 10 : 0;
  let totalLikertScore = 0;
  let likertsAnswered = 0;

  Object.keys(likerts || {}).forEach((key) => {
    const response = likerts[key];
    if (response) {
      likertsAnswered++;
      if (response === 'Strongly Agree') totalLikertScore += 10;
      else if (response === 'Agree') totalLikertScore += 7;
      else if (response === 'Disagree') totalLikertScore += 3;
    }
  });

  if (likertsAnswered === 0) {
    return {
      criteriaScore,
      likertScore: 0,
      finalScore: criteriaScore,
      criteriaWeight: 1,
      likertWeight: 0,
      likertsAnswered: 0
    };
  }

  const likertScore = Math.round((totalLikertScore / (likertsAnswered * 10)) * 1000) / 10;
  const finalScore = Math.round((criteriaScore * 0.6 + likertScore * 0.4) * 10) / 10;

  return {
    criteriaScore,
    likertScore,
    finalScore,
    criteriaWeight: 0.6,
    likertWeight: 0.4,
    likertsAnswered
  };
};

const evaluateOverallPerformanceScore = (scores, rubrics, likerts) => {
  return computeScoreBreakdown(scores, rubrics, likerts).finalScore;
};

// ── Panel mode (multi-evaluator + join code) ──

const PANEL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const panelCreateModal = document.getElementById('panel-create-modal');
const panelJoinModal = document.getElementById('panel-join-modal');
const panelHubModal = document.getElementById('panel-hub-modal');
const panelCreateForm = document.getElementById('panel-create-form');
const panelJoinForm = document.getElementById('panel-join-form');
const panelJoinCodeInput = document.getElementById('panel-join-code-input');
const panelJoinError = document.getElementById('panel-join-error');
const panelHubCodeDisplay = document.getElementById('panel-hub-code-display');
const panelHubScorecardsList = document.getElementById('panel-hub-scorecards-list');
const panelHubCompiled = document.getElementById('panel-hub-compiled');
const panelHubCompiledScore = document.getElementById('panel-hub-compiled-score');
const panelHubCompiledMeta = document.getElementById('panel-hub-compiled-meta');
const panelHubSubtitle = document.getElementById('panel-hub-subtitle');
const panelModeBanner = document.getElementById('panel-mode-banner');
const panelLiveCode = document.getElementById('panel-live-code');
const panelLiveStatus = document.getElementById('panel-live-status');
const liveSubmitText = document.getElementById('live-submit-text');
const panelCreateTemplateName = document.getElementById('panel-create-template-name');

const panelsCollectionRef = () => collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels');
const panelDocRef = (panelId) => doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels', panelId);
const panelCandidatesCollectionRef = (panelId) => collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels', panelId, 'candidates');
const panelCandidateDocRef = (panelId, candidateId) => doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels', panelId, 'candidates', candidateId);
const panelScorecardsCollectionRef = (panelId, candidateId) => collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels', panelId, 'candidates', candidateId, 'scorecards');
const panelScorecardDocRef = (panelId, candidateId, uid) => doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'panels', panelId, 'candidates', candidateId, 'scorecards', uid);

const generatePanelJoinCode = () => {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += PANEL_CODE_CHARS[Math.floor(Math.random() * PANEL_CODE_CHARS.length)];
  }
  return code;
};

const isPanelModeActive = () => Boolean(activePanelId && activePanelCandidateId);

const setLiveInterviewPanelUI = (enabled) => {
  panelModeBanner?.classList.toggle('hidden', !enabled);
  document.getElementById('panel-candidate-fields-row')?.classList.toggle('hidden', enabled);
  document.getElementById('panel-live-candidate-info')?.classList.toggle('hidden', !enabled);
  if (enabled) document.getElementById('solo-roster-section')?.classList.add('hidden');

  if (liveSubmitText) {
    liveSubmitText.textContent = enabled
      ? 'Submit my scorecard'
      : 'Complete & Save Calibration';
  }

  const nameInput = document.getElementById('candidate-name');
  const roleInput = document.getElementById('candidate-role');
  const displayName = document.getElementById('panel-live-candidate-display');
  const displayRole = document.getElementById('panel-live-role-display');

  if (enabled && activePanelCandidate) {
    if (nameInput) {
      nameInput.value = activePanelCandidate.candidateName || '';
      nameInput.readOnly = true;
      nameInput.removeAttribute('required');
    }
    if (roleInput) {
      roleInput.value = activePanelCandidate.candidateRole || '';
      roleInput.readOnly = true;
    }
    if (displayName) displayName.textContent = activePanelCandidate.candidateName || 'Candidate';
    if (displayRole) {
      displayRole.textContent = activePanelCandidate.candidateRole || activePanel?.templateSnapshot?.role || '';
      displayRole.classList.toggle('hidden', !displayRole.textContent);
    }
  } else {
    if (nameInput) {
      nameInput.readOnly = false;
      nameInput.setAttribute('required', '');
    }
    if (roleInput) roleInput.readOnly = false;
  }
};

const openPanelModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

const closePanelModal = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

document.querySelectorAll('[data-panel-close]').forEach((el) => {
  el.addEventListener('click', () => closePanelModal(el.getAttribute('data-panel-close')));
});

const compilePanelAverage = (scorecards) => {
  const submitted = scorecards.filter((s) => s.status === 'submitted' && s.calculatedScore != null);
  if (!submitted.length) return null;

  const scores = submitted.map((s) => Number(s.calculatedScore));
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return {
    compiledScore: Math.round(mean * 10) / 10,
    scorecardCount: submitted.length,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    spread: Math.round((max - min) * 10) / 10,
    perInterviewer: submitted.map((s) => ({
      name: s.interviewerName || 'Evaluator',
      score: s.calculatedScore
    }))
  };
};

const recompilePanelCandidate = async (panelId, candidateId) => {
  if (!panelId || !candidateId || !currentWorkspace) return;
  try {
    const snap = await getDocs(panelScorecardsCollectionRef(panelId, candidateId));
    const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    panelScorecards = cards;
    const compiled = compilePanelAverage(cards);
    const candSnap = await getDoc(panelCandidateDocRef(panelId, candidateId));
    if (candSnap.exists() && candSnap.data().status !== 'finalized') {
      await updateDoc(panelCandidateDocRef(panelId, candidateId), {
        compiled: compiled || null,
        compiledAt: new Date().toISOString()
      });
      if (activePanelCandidate?.id === candidateId) activePanelCandidate.compiled = compiled;
      const idx = panelCandidates.findIndex((c) => c.id === candidateId);
      if (idx >= 0) panelCandidates[idx].compiled = compiled;
    }
    renderPanelHubContent();
  } catch (err) {
    console.error('Panel recompile failed:', err);
  }
};

const teardownPanelListeners = () => {
  if (unsubscribePanelScorecards) {
    unsubscribePanelScorecards();
    unsubscribePanelScorecards = null;
  }
  if (unsubscribePanelCandidates) {
    unsubscribePanelCandidates();
    unsubscribePanelCandidates = null;
  }
  if (unsubscribePanelDoc) {
    unsubscribePanelDoc();
    unsubscribePanelDoc = null;
  }
  activePanelId = null;
  activePanel = null;
  activePanelCandidateId = null;
  activePanelCandidate = null;
  panelCandidates = [];
  panelScorecards = [];
  panelJoinAutoEnter = false;
};

const setPanelActiveCandidate = async (candidateId) => {
  if (!activePanelId || !user || !candidateId) return;
  try {
    await updateDoc(panelDocRef(activePanelId), {
      activeCandidateId: candidateId,
      activeCandidateSetAt: new Date().toISOString(),
      activeCandidateSetBy: user.uid
    });
    if (activePanel) activePanel.activeCandidateId = candidateId;
  } catch (err) {
    console.error('Could not set active interview:', err);
  }
};

const maybeAutoEnterPanelInterview = () => {
  if (isPanelModeActive()) return;
  if (!activePanel?.activeCandidateId) return;
  if (panelJoinAutoEnter || !panelHubModal?.classList.contains('hidden')) {
    tryEnterActivePanelInterview();
  }
};

const subscribePanelDoc = (panelId) => {
  if (unsubscribePanelDoc) unsubscribePanelDoc();
  unsubscribePanelDoc = onSnapshot(panelDocRef(panelId), (snap) => {
    if (!snap.exists()) return;
    activePanel = { id: snap.id, ...snap.data() };
    maybeAutoEnterPanelInterview();
    if (!panelHubModal?.classList.contains('hidden')) {
      renderPanelHubContent();
    }
    updatePanelLiveBanner();
  }, (err) => console.error('Panel doc listener:', err));
};

const subscribePanelCandidates = (panelId) => {
  if (unsubscribePanelCandidates) unsubscribePanelCandidates();
  unsubscribePanelCandidates = onSnapshot(panelCandidatesCollectionRef(panelId), (snap) => {
    panelCandidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPanelHubContent();
    maybeAutoEnterPanelInterview();
  }, (err) => console.error('Panel candidates listener:', err));
};

const tryEnterActivePanelInterview = async () => {
  if (!activePanelId || !activePanel?.activeCandidateId) return false;

  const cand = panelCandidates.find((c) => c.id === activePanel.activeCandidateId);
  if (!cand || cand.status === 'finalized') return false;

  if (isPanelModeActive() && activePanelCandidateId === cand.id && activeInterviewTemplate) return true;

  selectPanelCandidate(cand.id);
  const started = await startPanelScorecardSession({ silent: true });
  if (!started) return false;

  panelJoinAutoEnter = false;
  closePanelModal('panel-join-modal');
  closePanelModal('panel-hub-modal');
  return true;
};

const pickPanelCandidateForInterview = async (candidateId) => {
  selectPanelCandidate(candidateId);
  await setPanelActiveCandidate(candidateId);
};

const subscribePanelScorecards = (panelId, candidateId) => {
  if (unsubscribePanelScorecards) unsubscribePanelScorecards();
  if (!panelId || !candidateId) return;
  unsubscribePanelScorecards = onSnapshot(panelScorecardsCollectionRef(panelId, candidateId), async (snap) => {
    panelScorecards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cand = panelCandidates.find((c) => c.id === candidateId) || activePanelCandidate;
    if (cand?.status !== 'finalized') {
      const compiled = compilePanelAverage(panelScorecards);
      if (activePanelCandidate?.id === candidateId) activePanelCandidate.compiled = compiled;
      try {
        await updateDoc(panelCandidateDocRef(panelId, candidateId), {
          compiled: compiled || null,
          compiledAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Panel compile update:', err);
      }
    }
    renderPanelHubContent();
    updatePanelLiveBanner();
  }, (err) => console.error('Panel scorecards listener:', err));
};

const selectPanelCandidate = (candidateId) => {
  const cand = panelCandidates.find((c) => c.id === candidateId);
  if (!cand || !activePanelId) return;
  activePanelCandidateId = candidateId;
  activePanelCandidate = { ...cand };
  subscribePanelScorecards(activePanelId, candidateId);
  renderPanelHubContent();
};

const panelHubCandidatesList = document.getElementById('panel-hub-candidates-list');
const panelHubSelectedSection = document.getElementById('panel-hub-selected-section');
const panelHubSelectedName = document.getElementById('panel-hub-selected-name');

const renderPanelHubContent = () => {
  if (!activePanel) return;

  if (panelHubCodeDisplay) panelHubCodeDisplay.textContent = activePanel.joinCode || '------';
  if (panelHubSubtitle) {
    panelHubSubtitle.textContent = activePanel.templateSnapshot?.title || 'Evaluation rubric';
  }

  if (panelHubCandidatesList) {
    panelHubCandidatesList.innerHTML = '';
    const filtered = getFilteredPanelCandidates();
    const countEl = document.getElementById('panel-candidate-count');
    if (countEl) {
      const total = panelCandidates.length;
      if (panelCandidateSearchQuery.trim()) {
        countEl.textContent = `${filtered.length} of ${total} shown`;
      } else {
        countEl.textContent = total ? `${total} candidate${total !== 1 ? 's' : ''}` : '';
      }
    }

    if (panelCandidates.length === 0) {
      panelHubCandidatesList.innerHTML = '<li class="text-xs text-slate-500 py-2">No candidates yet — import a roster, add manually, then evaluators score using this panel code.</li>';
    } else if (filtered.length === 0) {
      panelHubCandidatesList.innerHTML = '<li class="text-xs text-slate-500 py-2">No candidates match your search.</li>';
    } else {
      filtered.forEach((cand) => {
        const li = document.createElement('li');
        const isSelected = cand.id === activePanelCandidateId;
        const isActiveInterview = cand.id === activePanel?.activeCandidateId;
        const isFinalized = cand.status === 'finalized';
        const submitted = cand.compiled?.scorecardCount || 0;
        const avg = cand.compiled?.compiledScore;
        li.className = `panel-scorecard-item ${isSelected ? 'ring-2 ring-violet-400' : ''} ${isFinalized ? 'opacity-75' : ''} ${isActiveInterview ? 'ring-2 ring-rose-300 bg-rose-50/50' : ''}`;
        li.innerHTML = `
          <div class="flex-1 min-w-0">
            <strong class="block text-sm text-slate-900">${escapeHtml(cand.candidateName)}</strong>
            <span class="text-[11px] text-slate-500">${escapeHtml(cand.candidateRole || '—')}${isFinalized ? ' · Finalized' : ''}${isActiveInterview ? ' · <span class="text-rose-600 font-semibold">Live now</span>' : ''}</span>
          </div>
          <span class="text-xs font-bold tabular-nums shrink-0">${avg != null ? `${avg}%` : submitted ? `${submitted} submitted` : '—'}</span>
          <div class="flex gap-1 shrink-0">
            ${isFinalized ? '' : `<button type="button" class="btn-panel-pick-cand rounded-full ${isActiveInterview ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'} px-2.5 py-1 text-[10px] font-bold" data-id="${cand.id}">${isActiveInterview ? 'Join interview' : 'Score'}</button>`}
          </div>
        `;
        li.querySelector('.btn-panel-pick-cand')?.addEventListener('click', async () => {
          await pickPanelCandidateForInterview(cand.id);
          await startPanelScorecardSession();
        });
        panelHubCandidatesList.appendChild(li);
      });
    }
  }

  const showSelected = Boolean(activePanelCandidateId && activePanelCandidate);
  panelHubSelectedSection?.classList.toggle('hidden', !showSelected);
  if (panelHubSelectedName && activePanelCandidate) {
    panelHubSelectedName.textContent = activePanelCandidate.candidateName;
  }

  const compiled = activePanelCandidate?.compiled;
  if (panelHubCompiled && panelHubCompiledScore && panelHubCompiledMeta) {
    if (compiled?.compiledScore != null) {
      panelHubCompiled.classList.remove('hidden');
      panelHubCompiledScore.textContent = compiled.compiledScore;
      panelHubCompiledMeta.textContent = `${compiled.scorecardCount} submitted · range ${compiled.min}%–${compiled.max}% (spread ${compiled.spread}%)`;
    } else {
      panelHubCompiled.classList.add('hidden');
    }
  }

  if (panelHubScorecardsList) {
    panelHubScorecardsList.innerHTML = '';
    if (!showSelected) {
      panelHubScorecardsList.innerHTML = '<li class="text-xs text-slate-500 py-2">Select a candidate to see evaluator scorecards.</li>';
    } else if (panelScorecards.length === 0) {
      panelHubScorecardsList.innerHTML = '<li class="text-xs text-slate-500 py-2">No scorecards yet for this candidate.</li>';
    } else {
      panelScorecards.forEach((card) => {
        const li = document.createElement('li');
        const status = card.status === 'submitted' ? 'submitted' : 'draft';
        li.className = `panel-scorecard-item panel-scorecard-item--${status}`;
        const scoreLabel = card.status === 'submitted' ? `${card.calculatedScore}%` : 'In progress';
        li.innerHTML = `
          <span><strong>${escapeHtml(card.interviewerName || 'Evaluator')}</strong>${card.id === user?.uid ? ' <span class="text-violet-600">(you)</span>' : ''}</span>
          <span class="font-bold tabular-nums">${scoreLabel}</span>
        `;
        panelHubScorecardsList.appendChild(li);
      });
    }
  }

  const submittedCount = panelScorecards.filter((c) => c.status === 'submitted').length;
  const btnFinalize = document.getElementById('btn-finalize-panel');
  const btnScore = document.getElementById('btn-start-my-scorecard');
  if (btnFinalize) {
    const finalized = activePanelCandidate?.status === 'finalized';
    btnFinalize.disabled = !showSelected || finalized || submittedCount === 0;
    btnFinalize.textContent = finalized ? 'Already finalized' : 'Finalize this candidate';
  }
  if (btnScore) {
    btnScore.disabled = !showSelected || activePanelCandidate?.status === 'finalized';
  }
};

const openPanelHub = async (panelId) => {
  if (!currentWorkspace || !user) return;
  try {
    const snap = await getDoc(panelDocRef(panelId));
    if (!snap.exists()) {
      showToast('Panel not found.', 'error');
      return;
    }
    activePanelId = panelId;
    activePanel = { id: panelId, ...snap.data() };
    activePanelCandidateId = null;
    activePanelCandidate = null;
    panelScorecards = [];
    panelCandidateSearchQuery = '';
    const searchInput = document.getElementById('panel-candidate-search');
    if (searchInput) searchInput.value = '';
    subscribePanelCandidates(panelId);
    subscribePanelDoc(panelId);
    renderPanelHubContent();
    openPanelModal('panel-hub-modal');
  } catch (err) {
    console.error(err);
    showToast('Could not open panel.', 'error');
  }
};

const ensureUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generatePanelJoinCode();
    const q = query(panelsCollectionRef(), where('joinCode', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) return code;
  }
  throw new Error('Could not generate a unique session code. Try again.');
};

const buildTemplateSnapshot = (template) => ({
  id: template.id,
  title: template.title,
  role: template.role || '',
  description: template.description || '',
  criteria: (template.criteria || []).map((c) => ({ ...c }))
});

const createOrOpenPanelForTemplate = async (template) => {
  if (!user || !currentWorkspace) {
    showToast('Sign in to a workspace first.', 'error');
    return null;
  }

  try {
    const openQ = query(panelsCollectionRef(), where('templateId', '==', template.id));
    const openSnap = await getDocs(openQ);
    const existingDoc = openSnap.docs.find((d) => d.data().status === 'open');

    if (existingDoc) {
      const existing = existingDoc;
      activePanelId = existing.id;
      activePanel = { id: existing.id, ...existing.data() };
      subscribePanelCandidates(existing.id);
      closePanelModal('panel-create-modal');
      openPanelModal('panel-hub-modal');
      renderPanelHubContent();
      showToast(`Using existing panel for this rubric. Code: ${activePanel.joinCode}`, 'info');
      return existing.id;
    }

    const joinCode = await ensureUniqueJoinCode();
    const panelData = {
      joinCode,
      templateId: template.id,
      templateSnapshot: buildTemplateSnapshot(template),
      status: 'open',
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      hostUid: user.uid
    };

    const panelRef = await addDoc(panelsCollectionRef(), panelData);
    activePanelId = panelRef.id;
    activePanel = { id: panelRef.id, ...panelData };

    subscribePanelCandidates(panelRef.id);
    closePanelModal('panel-create-modal');
    openPanelModal('panel-hub-modal');
    renderPanelHubContent();
    showToast(`Panel created for this rubric. Share code: ${joinCode}`, 'success');
    return panelRef.id;
  } catch (err) {
    console.error(err);
    showToast('Could not create panel.', 'error');
    return null;
  }
};

const addCandidateToPanel = async (name, role, options = {}) => {
  const { selectAfter = true, silent = false, importSource = null } = options;
  if (!activePanelId || !user) return null;
  const candidateName = name?.trim();
  if (!candidateName) {
    if (!silent) showToast('Enter a candidate name.', 'error');
    return null;
  }

  const normalized = normalizeCandidateNameKey(candidateName);
  const duplicate = panelCandidates.find((c) => normalizeCandidateNameKey(c.candidateName) === normalized);
  if (duplicate) {
    if (!silent) showToast(`${candidateName} is already on this panel.`, 'info');
    if (selectAfter) selectPanelCandidate(duplicate.id);
    return duplicate.id;
  }

  try {
    const payload = {
      candidateName: titleCaseCandidateName(candidateName),
      candidateRole: (role || activePanel?.templateSnapshot?.role || '').trim(),
      status: 'open',
      compiled: null,
      createdAt: new Date().toISOString(),
      createdBy: user.uid
    };
    if (importSource) {
      payload.importSource = importSource;
      payload.importedAt = new Date().toISOString();
    }

    const ref = await addDoc(panelCandidatesCollectionRef(activePanelId), payload);
    if (!silent) {
      document.getElementById('panel-add-candidate-name').value = '';
      document.getElementById('panel-add-candidate-role').value = '';
    }
    if (selectAfter) {
      selectPanelCandidate(ref.id);
      if (!silent) showToast(`${candidateName} added — select Score to begin.`, 'success');
    }
    return ref.id;
  } catch (err) {
    console.error(err);
    if (!silent) showToast('Could not add candidate.', 'error');
    return null;
  }
};

// ── Roster import (Excel / CSV / PDF) ──

const NAME_COLUMN_HINTS = ['name', 'candidate', 'candidate name', 'full name', 'applicant', 'student', 'student name', 'interviewee', 'employee', 'applicant name'];
const ROLE_COLUMN_HINTS = ['role', 'position', 'title', 'job', 'job title', 'position title', 'designation'];
const ROSTER_SKIP_PATTERNS = /^(name|candidate|email|phone|sr\.?\s*no|s\.?\s*no|serial|#|id|date|total|marks|score|rank|sl\.?\s*no)/i;

const normalizeCandidateNameKey = (name) => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

const titleCaseCandidateName = (name) => String(name || '').trim().replace(/\s+/g, ' ')
  .split(' ')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  .join(' ');

const isLikelyPersonName = (str, { loose = false } = {}) => {
  const s = String(str).trim();
  if (s.length < 2 || s.length > 80) return false;
  if (/^\d+([.,]\d+)?$/.test(s)) return false;
  if (/@|https?:|www\.|\.com\b|\.pdf\b|\|/.test(s)) return false;
  if (ROSTER_SKIP_PATTERNS.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (loose) {
    return words.length >= 1 && words.length <= 6 && /^[\p{L}\d'.\-\s]+$/u.test(s) && !/^\d/.test(s);
  }
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[\p{L}'.\-]+$/u.test(w) && w.length > 1);
};

const dedupeImportRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalizeCandidateNameKey(row.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findSheetColumn = (headers, hints) => {
  const normalized = headers.map((h) => String(h ?? '').trim().toLowerCase());
  let idx = normalized.findIndex((h) => hints.some((k) => h === k || h.includes(k) || k.includes(h)));
  if (idx < 0) idx = normalized.findIndex((h) => hints.some((k) => h.replace(/\s/g, '').includes(k.replace(/\s/g, ''))));
  return idx;
};

const extractCandidatesFromSheetRows = (rows) => {
  if (!rows?.length) return [];

  let startRow = 0;
  let nameCol = 0;
  let roleCol = -1;

  const headerCells = (rows[0] || []).map((c) => String(c).trim());
  const headerLower = headerCells.map((h) => h.toLowerCase());
  const nameIdx = findSheetColumn(headerLower, NAME_COLUMN_HINTS);

  if (nameIdx >= 0) {
    startRow = 1;
    nameCol = nameIdx;
    roleCol = findSheetColumn(headerLower, ROLE_COLUMN_HINTS);
  }

  const out = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rawName = String(row[nameCol] ?? '').trim();
    if (!rawName) continue;
    if (!isLikelyPersonName(rawName, { loose: true }) && !isLikelyPersonName(rawName)) continue;

    const role = roleCol >= 0 ? String(row[roleCol] ?? '').trim() : '';
    out.push({
      name: titleCaseCandidateName(rawName),
      role: role && !ROSTER_SKIP_PATTERNS.test(role) ? role : ''
    });
  }
  return dedupeImportRows(out);
};

const parseSpreadsheetFile = async (file) => {
  await loadScript(SCRIPT_URLS.xlsx);
  if (!window.XLSX) throw new Error('Excel library failed to load.');
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return extractCandidatesFromSheetRows(rows);
};

const extractNamesFromPdfText = (text) => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const cleaned = line.replace(/\s{2,}/g, ' ').replace(/^\d+[.)]\s*/, '').trim();
    if (!cleaned) continue;
    if (isLikelyPersonName(cleaned, { loose: true }) || isLikelyPersonName(cleaned)) {
      out.push({ name: titleCaseCandidateName(cleaned), role: '' });
    }
  }
  return dedupeImportRows(out);
};

const parsePdfFile = async (file) => {
  await loadScript(SCRIPT_URLS.pdfjs);
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF library failed to load.');

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += `${pageText}\n`;
  }

  return extractNamesFromPdfText(fullText);
};

const parseRosterFile = async (file) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return parsePdfFile(file);
  if (['xlsx', 'xls', 'csv'].includes(ext)) return parseSpreadsheetFile(file);
  throw new Error('Unsupported file type. Use .xlsx, .xls, .csv, or .pdf');
};

const getFilteredPanelCandidates = () => {
  const q = panelCandidateSearchQuery.trim().toLowerCase();
  if (!q) return panelCandidates;
  return panelCandidates.filter((c) => {
    const name = (c.candidateName || '').toLowerCase();
    const role = (c.candidateRole || '').toLowerCase();
    return name.includes(q) || role.includes(q);
  });
};

const renderImportPreviewModal = (rows, fileName, context = 'panel') => {
  const listEl = document.getElementById('panel-import-list');
  const subtitle = document.getElementById('panel-import-subtitle');
  const helpEl = document.getElementById('import-modal-help');
  if (!listEl) return;

  importModalContext = context;
  pendingImportRows = rows;
  if (subtitle) subtitle.textContent = `${rows.length} name${rows.length !== 1 ? 's' : ''} found in ${fileName}`;
  if (helpEl) {
    helpEl.textContent = context === 'solo'
      ? 'Uncheck any rows you don’t want. Names already on your solo roster will be skipped.'
      : 'Uncheck any rows you don’t want. Duplicates already in this panel will be skipped on import.';
  }

  const existingKeys = context === 'solo'
    ? new Set(soloRosterQueue.map((c) => normalizeCandidateNameKey(c.name)))
    : new Set(panelCandidates.map((c) => normalizeCandidateNameKey(c.candidateName)));
  const dupLabel = context === 'solo' ? 'Already on roster' : 'Already on panel';

  listEl.innerHTML = '';
  if (rows.length === 0) {
    listEl.innerHTML = '<p class="text-xs text-slate-500 p-2">No candidate names detected. Try a sheet with a Name column or one name per line in the PDF.</p>';
  } else {
    rows.forEach((row, index) => {
      const isDup = existingKeys.has(normalizeCandidateNameKey(row.name));
      const div = document.createElement('label');
      div.className = `panel-import-row ${isDup ? 'is-duplicate' : ''}`;
      div.innerHTML = `
        <input type="checkbox" class="panel-import-check" data-index="${index}" ${isDup ? '' : 'checked'} />
        <span class="panel-import-row__name">${escapeHtml(row.name)}</span>
        ${row.role ? `<span class="panel-import-row__role">${escapeHtml(row.role)}</span>` : ''}
        ${isDup ? `<span class="text-[10px] text-amber-700 font-semibold">${dupLabel}</span>` : ''}
      `;
      listEl.appendChild(div);
    });
  }

  openPanelModal('panel-import-modal');
};

const bulkImportSelectedCandidates = async (importSource) => {
  if (!activePanelId || !user) return;

  const checks = document.querySelectorAll('.panel-import-check:checked');
  const selected = [];
  checks.forEach((el) => {
    const idx = Number(el.getAttribute('data-index'));
    if (pendingImportRows[idx]) selected.push(pendingImportRows[idx]);
  });

  if (selected.length === 0) {
    showToast('Select at least one candidate to import.', 'error');
    return;
  }

  const btn = document.getElementById('btn-roster-import-confirm');
  if (btn) btn.disabled = true;

  let added = 0;
  let skipped = 0;
  const existingKeys = new Set(panelCandidates.map((c) => normalizeCandidateNameKey(c.candidateName)));

  try {
    for (const row of selected) {
      const key = normalizeCandidateNameKey(row.name);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      const id = await addCandidateToPanel(row.name, row.role, {
        selectAfter: false,
        silent: true,
        importSource
      });
      if (id) {
        added++;
        existingKeys.add(key);
      } else {
        skipped++;
      }
    }

    closePanelModal('panel-import-modal');
    pendingImportRows = [];
    renderPanelHubContent();
    showToast(`Imported ${added} candidate${added !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped as duplicates)` : ''}.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Import failed. Please try again.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

const handlePanelRosterImport = async (file) => {
  if (!activePanelId) {
    showToast('Open a panel first.', 'error');
    return;
  }

  try {
    showToast('Reading file…', 'info');
    const rows = await parseRosterFile(file);
    pendingImportFileName = file.name;
    renderImportPreviewModal(rows, file.name, 'panel');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not read that file.', 'error');
  }
};

// ── Solo interview roster (Excel / CSV / PDF) ──

const getSoloRosterStorageKey = () => {
  if (!currentWorkspace || !user || !activeInterviewTemplate?.id) return null;
  return `tc-solo-roster:${currentWorkspace}:${user.uid}:${activeInterviewTemplate.id}`;
};

const loadSoloRoster = () => {
  const key = getSoloRosterStorageKey();
  if (!key) {
    soloRosterQueue = [];
    return;
  }
  try {
    const raw = localStorage.getItem(key);
    soloRosterQueue = raw ? JSON.parse(raw) : [];
  } catch {
    soloRosterQueue = [];
  }
};

const saveSoloRoster = () => {
  const key = getSoloRosterStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(soloRosterQueue));
  } catch (_) { /* ignore */ }
};

const getFilteredSoloRoster = () => {
  const q = soloRosterSearchQuery.trim().toLowerCase();
  if (!q) return soloRosterQueue;
  return soloRosterQueue.filter((c) => {
    const name = (c.name || '').toLowerCase();
    const role = (c.role || '').toLowerCase();
    return name.includes(q) || role.includes(q);
  });
};

const renderSoloRosterList = () => {
  const listEl = document.getElementById('solo-roster-list');
  const countEl = document.getElementById('solo-roster-count');
  if (!listEl) return;

  const filtered = getFilteredSoloRoster();
  const doneCount = soloRosterQueue.filter((c) => c.status === 'done').length;

  if (countEl) {
    if (!soloRosterQueue.length) {
      countEl.textContent = '';
    } else if (soloRosterSearchQuery.trim()) {
      countEl.textContent = `${filtered.length} of ${soloRosterQueue.length} shown`;
    } else {
      countEl.textContent = `${doneCount}/${soloRosterQueue.length} done`;
    }
  }

  listEl.innerHTML = '';
  if (!soloRosterQueue.length) {
    listEl.innerHTML = '<li class="text-xs text-slate-500 py-2">No roster yet — upload Excel, CSV, or PDF above.</li>';
    return;
  }
  if (!filtered.length) {
    listEl.innerHTML = '<li class="text-xs text-slate-500 py-2">No candidates match your search.</li>';
    return;
  }

  filtered.forEach((entry) => {
    const index = soloRosterQueue.indexOf(entry);
    const li = document.createElement('li');
    const isCurrent = entry.status === 'current';
    const isDone = entry.status === 'done';
    li.className = `panel-scorecard-item ${isCurrent ? 'ring-2 ring-indigo-400 bg-indigo-50/60' : ''} ${isDone ? 'opacity-60' : ''}`;
    li.innerHTML = `
      <div class="flex-1 min-w-0">
        <strong class="block text-sm text-slate-900">${escapeHtml(entry.name)}</strong>
        <span class="text-[11px] text-slate-500">${escapeHtml(entry.role || '—')}${isDone ? ' · Done' : isCurrent ? ' · <span class="text-indigo-600 font-semibold">Current</span>' : ''}</span>
      </div>
      ${isDone ? '' : `<button type="button" class="btn-solo-pick-cand rounded-full ${isCurrent ? 'bg-indigo-200 text-indigo-900' : 'bg-indigo-100 text-indigo-800'} px-2.5 py-1 text-[10px] font-bold">${isCurrent ? 'Selected' : 'Select'}</button>`}
    `;
    li.querySelector('.btn-solo-pick-cand')?.addEventListener('click', () => {
      selectSoloRosterCandidate(index);
    });
    listEl.appendChild(li);
  });
};

const setSoloRosterUIVisible = (visible) => {
  const section = document.getElementById('solo-roster-section');
  if (!section || isPanelModeActive()) {
    section?.classList.add('hidden');
    return;
  }
  section.classList.toggle('hidden', !visible);
  if (visible) renderSoloRosterList();
};

const hasLiveInterviewProgress = () => {
  if (!activeInterviewTemplate) return false;
  const hasScores = Object.values(candidateScores || {}).some(Boolean);
  const hasLikerts = Object.values(likertResponses || {}).some(Boolean);
  const hasNotes = document.getElementById('candidate-strengths')?.value?.trim()
    || document.getElementById('candidate-weaknesses')?.value?.trim()
    || document.getElementById('overall-feedback')?.value?.trim();
  return hasScores || hasLikerts || Boolean(hasNotes) || interviewDuration > 0;
};

const resetLiveFormForNewCandidate = (name, role) => {
  if (!activeInterviewTemplate) return;

  document.getElementById('candidate-name').value = name;
  document.getElementById('candidate-role').value = role || activeInterviewTemplate.role || '';
  document.getElementById('candidate-strengths').value = '';
  document.getElementById('candidate-weaknesses').value = '';
  document.getElementById('overall-feedback').value = '';

  candidateScores = {};
  candidateNotes = {};
  likertResponses = {};
  activeInterviewTemplate.criteria.forEach((c) => {
    candidateNotes[c.id] = '';
  });

  interviewDuration = 0;
  clearInterval(timerInterval);
  updateLiveTimerDisplay(0);
  timerInterval = setInterval(() => {
    interviewDuration++;
    updateLiveTimerDisplay(interviewDuration);
    if (interviewDuration % 30 === 0) scheduleDraftSave();
  }, 1000);

  navActiveCandidateName.textContent = name;
  renderLiveInterviewSheet();
  scheduleDraftSave();
};

const selectSoloRosterCandidate = (index, { force = false } = {}) => {
  const entry = soloRosterQueue[index];
  if (!entry || entry.status === 'done') return;

  if (!force && hasLiveInterviewProgress()) {
    const currentName = document.getElementById('candidate-name')?.value?.trim();
    if (currentName && normalizeCandidateNameKey(currentName) !== normalizeCandidateNameKey(entry.name)) {
      if (!window.confirm(`Switch to ${entry.name}? Unsaved ratings for the current candidate will be cleared.`)) return;
    }
  }

  soloRosterQueue.forEach((c, i) => {
    if (i === index) c.status = 'current';
    else if (c.status === 'current') c.status = 'pending';
  });

  saveSoloRoster();
  resetLiveFormForNewCandidate(entry.name, entry.role);
  renderSoloRosterList();
};

const syncSoloRosterCurrentFromName = (name) => {
  const key = normalizeCandidateNameKey(name);
  if (!key || !soloRosterQueue.length) return;

  let matched = false;
  soloRosterQueue.forEach((c) => {
    if (normalizeCandidateNameKey(c.name) === key && c.status !== 'done') {
      c.status = 'current';
      matched = true;
    } else if (c.status === 'current') {
      c.status = 'pending';
    }
  });

  if (matched) {
    saveSoloRoster();
    renderSoloRosterList();
  }
};

const markSoloRosterCandidateDone = (candidateName) => {
  const key = normalizeCandidateNameKey(candidateName);
  if (!key) return;

  soloRosterQueue.forEach((c) => {
    if (normalizeCandidateNameKey(c.name) === key) c.status = 'done';
    else if (c.status === 'current') c.status = 'pending';
  });
  saveSoloRoster();
  renderSoloRosterList();
};

const bulkImportSoloRoster = async (importSource) => {
  if (!activeInterviewTemplate || !user) {
    showToast('Start a solo interview first.', 'error');
    return;
  }

  const checks = document.querySelectorAll('.panel-import-check:checked');
  const selected = [];
  checks.forEach((el) => {
    const idx = Number(el.getAttribute('data-index'));
    if (pendingImportRows[idx]) selected.push(pendingImportRows[idx]);
  });

  if (selected.length === 0) {
    showToast('Select at least one candidate to import.', 'error');
    return;
  }

  const btn = document.getElementById('btn-roster-import-confirm');
  if (btn) btn.disabled = true;

  let added = 0;
  let skipped = 0;
  const existingKeys = new Set(soloRosterQueue.map((c) => normalizeCandidateNameKey(c.name)));

  try {
    for (const row of selected) {
      const key = normalizeCandidateNameKey(row.name);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      soloRosterQueue.push({
        name: row.name,
        role: row.role || '',
        status: 'pending',
        importSource
      });
      existingKeys.add(key);
      added++;
    }

    saveSoloRoster();
    closePanelModal('panel-import-modal');
    pendingImportRows = [];
    renderSoloRosterList();
    setSoloRosterUIVisible(true);
    showToast(`Added ${added} candidate${added !== 1 ? 's' : ''} to roster${skipped ? ` (${skipped} skipped as duplicates)` : ''}.`, 'success');

    const firstNew = soloRosterQueue.find((c) => c.status === 'pending');
    if (firstNew && !document.getElementById('candidate-name')?.value?.trim()) {
      selectSoloRosterCandidate(soloRosterQueue.indexOf(firstNew), { force: true });
    }
  } catch (err) {
    console.error(err);
    showToast('Import failed. Please try again.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

const handleSoloRosterImport = async (file) => {
  if (!activeInterviewTemplate) {
    showToast('Start a solo interview first.', 'error');
    return;
  }

  try {
    showToast('Reading file…', 'info');
    const rows = await parseRosterFile(file);
    pendingImportFileName = file.name;
    renderImportPreviewModal(rows, file.name, 'solo');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not read that file.', 'error');
  }
};

const findPanelByJoinCode = async (code) => {
  const panelQ = query(panelsCollectionRef(), where('joinCode', '==', code));
  const panelSnap = await getDocs(panelQ);
  if (!panelSnap.empty) return { type: 'panel', doc: panelSnap.docs[0] };

  const legacyQ = query(collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'evaluations'), where('joinCode', '==', code));
  const legacySnap = await getDocs(legacyQ);
  if (!legacySnap.empty) return { type: 'legacy', doc: legacySnap.docs[0] };
  return null;
};

const joinPanelByCode = async (rawCode) => {
  if (!user || !currentWorkspace) {
    showToast('Enter a workspace before joining a panel.', 'error');
    return null;
  }

  const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) {
    if (panelJoinError) {
      panelJoinError.textContent = 'Enter a valid 6-character code.';
      panelJoinError.classList.remove('hidden');
    }
    return null;
  }

  try {
    const found = await findPanelByJoinCode(code);
    if (!found) {
      if (panelJoinError) {
        panelJoinError.textContent = 'No panel found with that code in this workspace.';
        panelJoinError.classList.remove('hidden');
      }
      return null;
    }

    if (found.type === 'legacy') {
      showToast('This code is from an older session. Ask the host to create a new panel from Panel Mode on the rubric.', 'error');
      return null;
    }

    const panelDoc = found.doc;
    if (panelDoc.data().status !== 'open') {
      if (panelJoinError) {
        panelJoinError.textContent = 'This panel is closed.';
        panelJoinError.classList.remove('hidden');
      }
      return null;
    }

    activePanelId = panelDoc.id;
    activePanel = { id: panelDoc.id, ...panelDoc.data() };
    activePanelCandidateId = null;
    activePanelCandidate = null;
    panelJoinAutoEnter = true;

    subscribePanelCandidates(panelDoc.id);
    subscribePanelDoc(panelDoc.id);

    const candsSnap = await getDocs(panelCandidatesCollectionRef(panelDoc.id));
    panelCandidates = candsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    closePanelModal('panel-join-modal');
    panelJoinError?.classList.add('hidden');

    const entered = await tryEnterActivePanelInterview();
    if (!entered) {
      panelJoinAutoEnter = false;
      openPanelModal('panel-hub-modal');
      renderPanelHubContent();
      showToast('Joined panel. Waiting for a live interview — or pick a candidate and tap Score.', 'info');
    } else {
      showToast(`You're in — scoring ${activePanelCandidate?.candidateName || 'candidate'}.`, 'success');
    }
    return panelDoc.id;
  } catch (err) {
    console.error(err);
    showToast('Could not join panel. Check your connection.', 'error');
    return null;
  }
};

const loadScorecardIntoLiveForm = (card) => {
  document.getElementById('candidate-name').value = activePanelCandidate?.candidateName || '';
  document.getElementById('candidate-role').value = activePanelCandidate?.candidateRole || '';
  document.getElementById('interviewer-name').value = card?.interviewerName || '';
  document.getElementById('date-of-interview').value = card?.date || new Date().toISOString().split('T')[0];
  document.getElementById('candidate-strengths').value = card?.strengths || '';
  document.getElementById('candidate-weaknesses').value = card?.weaknesses || '';
  document.getElementById('overall-feedback').value = card?.overallFeedback || '';
  document.getElementById('local-scratchpad').value = card?.scratchpad || '';

  candidateScores = { ...(card?.scores || {}) };
  candidateNotes = { ...(card?.notes || {}) };
  likertResponses = { ...(card?.likertAnswers || {}) };
  interviewDuration = card?.durationSeconds || 0;
};

const startPanelScorecardSession = async (options = {}) => {
  const { silent = false } = options;
  if (!activePanelId || !activePanel || !activePanelCandidateId || !activePanelCandidate || !user) {
    if (!silent) showToast('Select a candidate in the panel first.', 'error');
    return false;
  }

  if (activePanelCandidate.status === 'finalized') {
    if (!silent) showToast('This candidate is finalized. No more scorecards can be submitted.', 'error');
    return false;
  }

  await setPanelActiveCandidate(activePanelCandidateId);

  const tpl = activePanel.templateSnapshot;
  activeInterviewTemplate = {
    id: tpl.id,
    title: tpl.title,
    role: tpl.role,
    description: tpl.description,
    criteria: tpl.criteria || []
  };

  let cardData = null;
  try {
    const snap = await getDoc(panelScorecardDocRef(activePanelId, activePanelCandidateId, user.uid));
    if (snap.exists()) cardData = snap.data();
  } catch (err) {
    console.error(err);
  }

  if (cardData?.status === 'submitted' && !silent) {
    if (!window.confirm('You already submitted a scorecard. Open again to edit and resubmit?')) return false;
  } else if (cardData?.status === 'submitted' && silent) {
    return false;
  }

  loadScorecardIntoLiveForm(cardData);

  candidateScores = candidateScores || {};
  candidateNotes = candidateNotes || {};
  activeInterviewTemplate.criteria.forEach((c) => {
    if (candidateNotes[c.id] === undefined) candidateNotes[c.id] = '';
  });

  if (!cardData) {
    document.getElementById('interviewer-name').value = '';
    document.getElementById('date-of-interview').value = new Date().toISOString().split('T')[0];
    likertResponses = {};
  }

  clearInterval(timerInterval);
  updateLiveTimerDisplay(interviewDuration);
  timerInterval = setInterval(() => {
    interviewDuration++;
    updateLiveTimerDisplay(interviewDuration);
    if (interviewDuration % 30 === 0) scheduleDraftSave();
  }, 1000);

  navActiveCandidateName.textContent = activePanelCandidate.candidateName;
  navActiveAssessmentContainer.classList.remove('hidden');
  setLiveInterviewPanelUI(true);
  setSoloRosterUIVisible(false);
  if (panelLiveCode) panelLiveCode.textContent = activePanel.joinCode;
  updatePanelLiveBanner();
  renderLiveInterviewSheet();
  bindLiveInterviewAutosave();
  closePanelModal('panel-hub-modal');
  switchTab('live-interview');
  return true;
};

const updatePanelLiveBanner = () => {
  if (!panelLiveStatus || !activePanelId) return;
  const submitted = panelScorecards.filter((c) => c.status === 'submitted').length;
  const total = panelScorecards.length;
  const compiled = activePanelCandidate?.compiled;
  const candName = activePanelCandidate?.candidateName || 'Candidate';
  let text = `${candName}: ${submitted} of ${total} scorecard${total !== 1 ? 's' : ''} submitted`;
  if (compiled?.compiledScore != null) text += ` · average ${compiled.compiledScore}%`;
  panelLiveStatus.textContent = text;
};

const savePanelScorecardDraft = async () => {
  if (!activePanelId || !activePanelCandidateId || !user || !activeInterviewTemplate) return;

  const interviewerName = document.getElementById('interviewer-name')?.value?.trim() || 'Evaluator';
  const calculatedScore = evaluateOverallPerformanceScore(
    candidateScores,
    activeInterviewTemplate.criteria,
    likertResponses
  );

  const payload = {
    interviewerId: user.uid,
    interviewerName,
    status: 'draft',
    scores: { ...candidateScores },
    notes: { ...candidateNotes },
    likertAnswers: { ...likertResponses },
    strengths: document.getElementById('candidate-strengths')?.value || '',
    weaknesses: document.getElementById('candidate-weaknesses')?.value || '',
    overallFeedback: document.getElementById('overall-feedback')?.value || '',
    scratchpad: document.getElementById('local-scratchpad')?.value || '',
    date: document.getElementById('date-of-interview')?.value || '',
    calculatedScore,
    durationSeconds: interviewDuration,
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(panelScorecardDocRef(activePanelId, activePanelCandidateId, user.uid), payload, { merge: true });
  } catch (err) {
    console.error('Panel draft save failed:', err);
  }
};

const submitPanelScorecard = async () => {
  if (!activePanelId || !activePanelCandidateId || !user || !activeInterviewTemplate) return false;

  const interviewerName = document.getElementById('interviewer-name')?.value?.trim();
  if (!interviewerName) {
    showToast('Enter your name as the interviewer before submitting.', 'error');
    document.getElementById('interviewer-name')?.focus();
    return false;
  }

  const calculatedScore = evaluateOverallPerformanceScore(
    candidateScores,
    activeInterviewTemplate.criteria,
    likertResponses
  );

  const payload = {
    interviewerId: user.uid,
    interviewerName,
    status: 'submitted',
    scores: { ...candidateScores },
    notes: { ...candidateNotes },
    likertAnswers: { ...likertResponses },
    strengths: document.getElementById('candidate-strengths')?.value || '',
    weaknesses: document.getElementById('candidate-weaknesses')?.value || '',
    overallFeedback: document.getElementById('overall-feedback')?.value || '',
    date: document.getElementById('date-of-interview')?.value || '',
    calculatedScore,
    durationSeconds: interviewDuration,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(panelScorecardDocRef(activePanelId, activePanelCandidateId, user.uid), payload, { merge: true });
  await recompilePanelCandidate(activePanelId, activePanelCandidateId);
  return true;
};

const finalizePanelEvaluation = async () => {
  if (!activePanelId || !activePanel || !activePanelCandidateId || !activePanelCandidate || !user) {
    showToast('Select a candidate to finalize.', 'error');
    return;
  }

  const candRef = panelCandidateDocRef(activePanelId, activePanelCandidateId);
  const caseSnap = await getDoc(candRef);
  if (!caseSnap.exists()) return;
  const caseData = caseSnap.data();
  if (caseData.status === 'finalized') {
    showToast('This candidate is already finalized.', 'info');
    return;
  }

  await recompilePanelCandidate(activePanelId, activePanelCandidateId);
  const refreshed = await getDoc(candRef);
  const data = refreshed.data();
  const compiled = data?.compiled;

  if (!compiled?.scorecardCount) {
    showToast('At least one evaluator must submit a scorecard before finalizing.', 'error');
    return;
  }

  if (!window.confirm(`Finalize ${data.candidateName}? Saves compiled average ${compiled.compiledScore}% to analytics.`)) return;

  const criteria = activePanel.templateSnapshot?.criteria || [];
  const hostCard = panelScorecards.find((c) => c.id === activePanel.hostUid) || panelScorecards[0];

  const candidateData = {
    name: data.candidateName,
    role: data.candidateRole || 'General Profile',
    interviewer: panelScorecards.map((c) => c.interviewerName).filter(Boolean).join(', ') || 'Panel',
    date: hostCard?.date || new Date().toISOString().split('T')[0],
    templateTitle: activePanel.templateSnapshot?.title || '',
    templateCriteria: criteria.map((c) => ({ ...c })),
    scores: hostCard?.scores || {},
    notes: hostCard?.notes || {},
    likertAnswers: hostCard?.likertAnswers || {},
    strengths: hostCard?.strengths || '',
    weaknesses: hostCard?.weaknesses || '',
    overallFeedback: hostCard?.overallFeedback || '',
    durationSeconds: hostCard?.durationSeconds || 0,
    calculatedScore: compiled.compiledScore,
    evaluatedAt: new Date().toISOString(),
    isPanelEvaluation: true,
    panelJoinCode: activePanel.joinCode,
    panelId: activePanelId,
    panelCandidateId: activePanelCandidateId,
    panelCompiled: compiled,
    panelScorecards: panelScorecards.map((c) => ({
      interviewerName: c.interviewerName,
      calculatedScore: c.calculatedScore,
      status: c.status
    }))
  };

  try {
    await addDoc(collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates'), candidateData);
    await updateDoc(candRef, {
      status: 'finalized',
      finalizedAt: new Date().toISOString(),
      finalizedBy: user.uid
    });
    if (activePanel?.activeCandidateId === activePanelCandidateId) {
      await updateDoc(panelDocRef(activePanelId), { activeCandidateId: null });
      activePanel.activeCandidateId = null;
    }
    activePanelCandidate.status = 'finalized';
    showToast(`Finalized ${data.candidateName} — ${compiled.compiledScore}% (avg of ${compiled.scorecardCount} scorecards)`);
    activePanelCandidateId = null;
    activePanelCandidate = null;
    panelScorecards = [];
    renderPanelHubContent();
  } catch (err) {
    console.error(err);
    showToast('Could not finalize.', 'error');
  }
};

const openPanelCreateModal = (template) => {
  panelTemplateForCreate = template;
  if (panelCreateTemplateName) panelCreateTemplateName.textContent = template.title;
  openPanelModal('panel-create-modal');
};

document.getElementById('btn-confirm-create-panel')?.addEventListener('click', async () => {
  if (!panelTemplateForCreate) return;
  await createOrOpenPanelForTemplate(panelTemplateForCreate);
});

document.getElementById('btn-panel-add-candidate')?.addEventListener('click', async () => {
  const name = document.getElementById('panel-add-candidate-name')?.value;
  const role = document.getElementById('panel-add-candidate-role')?.value;
  await addCandidateToPanel(name, role);
});

document.getElementById('panel-candidate-search')?.addEventListener('input', (e) => {
  panelCandidateSearchQuery = e.target.value;
  renderPanelHubContent();
});

document.getElementById('panel-import-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) await handlePanelRosterImport(file);
});

document.getElementById('solo-import-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) await handleSoloRosterImport(file);
});

document.getElementById('solo-roster-search')?.addEventListener('input', (e) => {
  soloRosterSearchQuery = e.target.value;
  renderSoloRosterList();
});

document.getElementById('btn-roster-import-confirm')?.addEventListener('click', async () => {
  if (importModalContext === 'solo') {
    await bulkImportSoloRoster(pendingImportFileName || 'roster-import');
  } else {
    await bulkImportSelectedCandidates(pendingImportFileName || 'roster-import');
  }
});

panelJoinForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await joinPanelByCode(panelJoinCodeInput?.value);
});

panelJoinCodeInput?.addEventListener('input', () => {
  if (panelJoinCodeInput) {
    panelJoinCodeInput.value = panelJoinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }
  panelJoinError?.classList.add('hidden');
});

document.getElementById('btn-join-panel-dashboard')?.addEventListener('click', () => {
  if (!currentWorkspace) {
    showToast('Enter a workspace first.', 'error');
    return;
  }
  if (panelJoinCodeInput) panelJoinCodeInput.value = '';
  panelJoinError?.classList.add('hidden');
  openPanelModal('panel-join-modal');
  setTimeout(() => panelJoinCodeInput?.focus(), 200);
});

document.getElementById('btn-copy-panel-code')?.addEventListener('click', () => {
  const code = activePanel?.joinCode || panelHubCodeDisplay?.textContent;
  if (!code) return;
  const rubric = activePanel?.templateSnapshot?.title || 'Interview rubric';
  const text = `Join my TalentCalibrate panel (${rubric}).\nWorkspace: ${currentWorkspace}\nPanel code: ${code}\n(Add candidates inside the panel after joining.)`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Code and instructions copied!'));
  } else {
    showToast(`Session code: ${code}`, 'info');
  }
});

document.getElementById('btn-start-my-scorecard')?.addEventListener('click', () => startPanelScorecardSession());
document.getElementById('btn-finalize-panel')?.addEventListener('click', () => finalizePanelEvaluation());
document.getElementById('btn-open-panel-hub-from-live')?.addEventListener('click', () => {
  if (activePanelId) openPanelHub(activePanelId);
});

const getPerformerCategory = (score) => {
  if (score >= scoreThresholds.high) return { label: 'Top Performer', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (score < scoreThresholds.low) return { label: 'Low Performer', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  return { label: 'Mid Performer', color: 'bg-amber-100 text-amber-800 border-amber-300' };
};

const getFilteredCandidates = () => candidates.filter((cand) => {
  const name = (cand.name || '').toLowerCase();
  const interviewer = (cand.interviewer || '').toLowerCase();
  const templateTitle = (cand.templateTitle || '').toLowerCase();
  const query = filterQuery.toLowerCase();
  const matchesRole = filterRole === 'All' || cand.role === filterRole;
  const matchesSearch = !query || name.includes(query) || interviewer.includes(query) || templateTitle.includes(query);
  return matchesRole && matchesSearch;
});

const escapeCsvCell = (value) => {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

const buildExportRows = (list) => {
  const scoreKeys = new Set();
  const likertKeys = new Set();
  list.forEach((c) => {
    Object.keys(c.scores || {}).forEach((k) => scoreKeys.add(k));
    Object.keys(c.likertAnswers || {}).forEach((k) => likertKeys.add(k));
  });

  const likertLabels = {};
  MANDATORY_LIKERT_QUESTIONS.forEach((q) => { likertLabels[q.id] = q.text; });

  return list.map((c) => {
    const category = getPerformerCategory(c.calculatedScore);
    const row = {
      'Candidate Name': c.name || '',
      'Position / Role': c.role || '',
      'Interviewer': c.interviewer || '',
      'Interview Date': c.date || '',
      'Evaluation Template': c.templateTitle || '',
      'Final Score (%)': c.calculatedScore ?? '',
      'Performance Category': category.label,
      'Strengths': c.strengths || '',
      'Weaknesses': c.weaknesses || '',
      'Overall Feedback': c.overallFeedback || '',
      'Interview Duration': formatDuration(c.durationSeconds),
      'Evaluated At': c.evaluatedAt ? new Date(c.evaluatedAt).toLocaleString() : ''
    };

    scoreKeys.forEach((key) => {
      const label = `Criteria: ${key}`;
      row[label] = (c.scores || {})[key] || '';
      row[`${label} (Notes)`] = (c.notes || {})[key] || '';
    });

    likertKeys.forEach((key) => {
      const label = likertLabels[key] ? `Likert: ${likertLabels[key]}` : `Likert: ${key}`;
      row[label] = (c.likertAnswers || {})[key] || '';
    });

    return row;
  });
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportCandidatesCSV = () => {
  const list = getFilteredCandidates();
  if (list.length === 0) {
    showToast('No candidate records to export.', 'error');
    return;
  }

  const rows = buildExportRows(list);
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(','))
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const wsSlug = (currentWorkspace || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadBlob(blob, `TalentCalibrate_${wsSlug}_progress_${new Date().toISOString().slice(0, 10)}.csv`);
  showToast(`Exported ${list.length} record${list.length > 1 ? 's' : ''} to CSV.`);
};

const exportCandidatesExcel = async () => {
  const list = getFilteredCandidates();
  if (list.length === 0) {
    showToast('No candidate records to export.', 'error');
    return;
  }

  try {
    await loadScript(SCRIPT_URLS.xlsx);
  } catch (_) {
    showToast('Could not load Excel library. Try CSV export.', 'error');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Excel library not loaded. Use CSV export instead.', 'error');
    return;
  }

  const rows = buildExportRows(list);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidate Progress');
  const wsSlug = (currentWorkspace || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `TalentCalibrate_${wsSlug}_progress_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast(`Exported ${list.length} record${list.length > 1 ? 's' : ''} to Excel.`);
};

const destroyChart = (id) => {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
};

const scoreBarColor = (score) => {
  if (score >= scoreThresholds.high) return 'rgba(16, 185, 129, 0.85)';
  if (score < scoreThresholds.low) return 'rgba(244, 63, 94, 0.85)';
  return 'rgba(245, 158, 11, 0.85)';
};

const renderDashboardStats = (list) => {
  if (!dashboardStatsGrid) return;
  if (list.length === 0) {
    dashboardStatsGrid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-400 py-6">No data to display. Complete interviews first.</p>';
    return;
  }

  const scores = list.map((c) => c.calculatedScore || 0);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const max = Math.max(...scores);
  const topCount = list.filter((c) => c.calculatedScore >= scoreThresholds.high).length;

  const stats = [
    { label: 'Total Evaluations', value: list.length, bg: 'bg-indigo-50/80', border: 'border-indigo-200', labelColor: 'text-indigo-600', valueColor: 'text-indigo-900' },
    { label: 'Average Score', value: `${avg}%`, bg: 'bg-sky-50/80', border: 'border-sky-200', labelColor: 'text-sky-600', valueColor: 'text-sky-900' },
    { label: 'Highest Score', value: `${max}%`, bg: 'bg-emerald-50/80', border: 'border-emerald-200', labelColor: 'text-emerald-600', valueColor: 'text-emerald-900' },
    { label: 'Top Performers', value: topCount, bg: 'bg-amber-50/80', border: 'border-amber-200', labelColor: 'text-amber-600', valueColor: 'text-amber-900' }
  ];

  dashboardStatsGrid.innerHTML = stats.map((s) => `
    <div class="rounded-3xl border ${s.border} ${s.bg} p-4 text-center">
      <p class="text-[10px] font-bold uppercase tracking-[0.2em] ${s.labelColor}">${s.label}</p>
      <p class="mt-1 text-2xl font-black ${s.valueColor}">${s.value}</p>
    </div>
  `).join('');
};

const renderAnalyticsDashboard = async () => {
  if (!analyticsDashboardPanel) return;

  try {
    await loadScript(SCRIPT_URLS.chart);
  } catch (_) {
    showToast('Could not load chart library.', 'error');
    return;
  }

  if (typeof Chart === 'undefined') return;

  const list = getFilteredCandidates().slice().sort((a, b) => (b.calculatedScore || 0) - (a.calculatedScore || 0));
  renderDashboardStats(list);

  ['chart-scores-bar', 'chart-tier-doughnut', 'chart-role-avg', 'chart-role-count'].forEach(destroyChart);

  if (list.length === 0) return;

  const chartAnim = !isMobileDevice();
  const chartPerf = { animation: chartAnim, responsiveAnimationDuration: chartAnim ? 400 : 0 };
  const topT = list.filter((c) => c.calculatedScore >= scoreThresholds.high);
  const midT = list.filter((c) => c.calculatedScore >= scoreThresholds.low && c.calculatedScore < scoreThresholds.high);
  const lowT = list.filter((c) => c.calculatedScore < scoreThresholds.low);

  const scoresCanvas = document.getElementById('chart-scores-bar');
  if (scoresCanvas) {
    chartInstances['chart-scores-bar'] = new Chart(scoresCanvas, {
      type: 'bar',
      data: {
        labels: list.map((c) => c.name),
        datasets: [{
          label: 'Score (%)',
          data: list.map((c) => c.calculatedScore),
          backgroundColor: list.map((c) => scoreBarColor(c.calculatedScore)),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        ...chartPerf,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { ticks: { maxRotation: 45, minRotation: list.length > 6 ? 45 : 0, font: { size: 10 } } }
        }
      }
    });
  }

  const tierCanvas = document.getElementById('chart-tier-doughnut');
  if (tierCanvas) {
    chartInstances['chart-tier-doughnut'] = new Chart(tierCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Top Performers', 'Mid Performers', 'Low Performers'],
        datasets: [{
          data: [topT.length, midT.length, lowT.length],
          backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(244, 63, 94, 0.85)'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        ...chartPerf,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
      }
    });
  }

  const roleMap = {};
  list.forEach((c) => {
    const role = c.role || 'Unspecified';
    if (!roleMap[role]) roleMap[role] = { total: 0, count: 0 };
    roleMap[role].total += c.calculatedScore || 0;
    roleMap[role].count += 1;
  });
  const roles = Object.keys(roleMap);
  const roleAvgs = roles.map((r) => Math.round((roleMap[r].total / roleMap[r].count) * 10) / 10);
  const roleCounts = roles.map((r) => roleMap[r].count);

  const roleAvgCanvas = document.getElementById('chart-role-avg');
  if (roleAvgCanvas) {
    chartInstances['chart-role-avg'] = new Chart(roleAvgCanvas, {
      type: 'bar',
      data: {
        labels: roles,
        datasets: [{
          label: 'Avg Score (%)',
          data: roleAvgs,
          backgroundColor: 'rgba(99, 102, 241, 0.75)',
          borderRadius: 8
        }]
      },
      options: {
        ...chartPerf,
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
        }
      }
    });
  }

  const roleCountCanvas = document.getElementById('chart-role-count');
  if (roleCountCanvas) {
    chartInstances['chart-role-count'] = new Chart(roleCountCanvas, {
      type: 'bar',
      data: {
        labels: roles,
        datasets: [{
          label: 'Candidates',
          data: roleCounts,
          backgroundColor: 'rgba(14, 165, 233, 0.75)',
          borderRadius: 8
        }]
      },
      options: {
        ...chartPerf,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
};

const toggleAnalyticsDashboard = (show) => {
  dashboardVisible = show;
  if (!analyticsDashboardPanel || !btnToggleDashboard) return;

  analyticsDashboardPanel.classList.toggle('hidden', !show);
  btnToggleDashboard.innerHTML = show
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg> Hide Analytics Dashboard`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-10"/></svg> Open Analytics Dashboard`;

  if (show) {
    requestAnimationFrame(() => renderAnalyticsDashboard());
  } else {
    Object.keys(chartInstances).forEach(destroyChart);
  }
};

const getCandidateCriteria = (cand) => {
  if (cand.templateCriteria?.length) return cand.templateCriteria;
  const tpl = templates.find((t) => t.title === cand.templateTitle);
  if (tpl?.criteria?.length) return tpl.criteria;
  return Object.keys(cand.scores || {}).map((id) => ({
    id,
    name: id.replace(/^crit-/, '').replace(/-/g, ' '),
    weight: 0,
    desc: ''
  }));
};

const getRateBadgeClass = (rate) => {
  if (rate === 'VS') return 'detail-rate-vs';
  if (rate === 'S') return 'detail-rate-s';
  if (rate === 'NS') return 'detail-rate-ns';
  return 'detail-rate-na';
};

const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const applyScoreThresholdsToUI = () => {
  if (cutoffHighSlider) cutoffHighSlider.value = scoreThresholds.high;
  if (cutoffLowSlider) cutoffLowSlider.value = scoreThresholds.low;
  if (labelCutoffHigh) labelCutoffHigh.textContent = `${scoreThresholds.high}%`;
  if (labelCutoffLow) labelCutoffLow.textContent = `${scoreThresholds.low}%`;
};

const loadWorkspaceSettings = async () => {
  if (!currentWorkspace) return;
  try {
    const wsRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace);
    const snap = await getDoc(wsRef);
    const settings = snap.data()?.settings;
    if (settings?.scoreThresholds) {
      scoreThresholds = {
        high: Number(settings.scoreThresholds.high) || 80,
        low: Number(settings.scoreThresholds.low) || 50
      };
      applyScoreThresholdsToUI();
    }
  } catch (err) {
    console.error('Failed to load workspace settings:', err);
  }
};

const scheduleSaveWorkspaceSettings = () => {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    if (!currentWorkspace || !user) return;
    try {
      const wsRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace);
      await setDoc(wsRef, {
        settings: {
          scoreThresholds: { ...scoreThresholds },
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save workspace settings:', err);
    }
  }, 600);
};

const getDraftStorageKey = () => {
  if (!currentWorkspace || !user) return null;
  return `tc_draft_${app_id}_${currentWorkspace}_${user.uid}`;
};

const collectLiveInterviewState = () => {
  if (!activeInterviewTemplate) return null;
  if (isPanelModeActive()) {
    return {
      panelId: activePanelId,
      panelCandidateId: activePanelCandidateId,
      candidateName: activePanelCandidate?.candidateName,
      candidateRole: activePanelCandidate?.candidateRole,
      interviewerName: document.getElementById('interviewer-name')?.value || '',
      dateOfInterview: document.getElementById('date-of-interview')?.value || '',
      candidateScores: { ...candidateScores },
      candidateNotes: { ...candidateNotes },
      likertResponses: { ...likertResponses },
      strengths: document.getElementById('candidate-strengths')?.value || '',
      weaknesses: document.getElementById('candidate-weaknesses')?.value || '',
      overallFeedback: document.getElementById('overall-feedback')?.value || '',
      scratchpad: document.getElementById('local-scratchpad')?.value || '',
      durationSeconds: interviewDuration,
      savedAt: new Date().toISOString(),
      userId: user?.uid,
      templateSnapshot: {
        id: activeInterviewTemplate.id,
        title: activeInterviewTemplate.title,
        role: activeInterviewTemplate.role || '',
        description: activeInterviewTemplate.description || '',
        criteria: activeInterviewTemplate.criteria?.map((c) => ({ ...c })) || []
      }
    };
  }
  return {
    templateSnapshot: {
      id: activeInterviewTemplate.id,
      title: activeInterviewTemplate.title,
      role: activeInterviewTemplate.role || '',
      description: activeInterviewTemplate.description || '',
      criteria: activeInterviewTemplate.criteria?.map((c) => ({ ...c })) || []
    },
    candidateName: document.getElementById('candidate-name')?.value || '',
    candidateRole: document.getElementById('candidate-role')?.value || '',
    interviewerName: document.getElementById('interviewer-name')?.value || '',
    dateOfInterview: document.getElementById('date-of-interview')?.value || '',
    candidateScores: { ...candidateScores },
    candidateNotes: { ...candidateNotes },
    likertResponses: { ...likertResponses },
    strengths: document.getElementById('candidate-strengths')?.value || '',
    weaknesses: document.getElementById('candidate-weaknesses')?.value || '',
    overallFeedback: document.getElementById('overall-feedback')?.value || '',
    scratchpad: document.getElementById('local-scratchpad')?.value || '',
    durationSeconds: interviewDuration,
    savedAt: new Date().toISOString(),
    userId: user?.uid
  };
};

const saveInterviewDraft = async () => {
  if (isPanelModeActive()) {
    await savePanelScorecardDraft();
    return;
  }

  const draft = collectLiveInterviewState();
  if (!draft || !currentWorkspace || !user) return;

  const hasContent = draft.candidateName?.trim()
    || Object.keys(draft.candidateScores).length > 0
    || Object.keys(draft.likertResponses).length > 0
    || draft.strengths || draft.weaknesses || draft.overallFeedback;

  if (!hasContent) return;

  cachedDraft = draft;
  const storageKey = getDraftStorageKey();
  if (storageKey) {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch (_) { /* ignore */ }
  }

  try {
    const draftRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'drafts', user.uid);
    await setDoc(draftRef, draft);
  } catch (err) {
    console.error('Draft Firestore save failed:', err);
  }

  renderDraftBanner();
};

const scheduleDraftSave = () => {
  if (!activeInterviewTemplate) return;
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveInterviewDraft, isMobileDevice() ? 3000 : 1500);
};

const loadInterviewDraft = async () => {
  if (!currentWorkspace || !user) {
    cachedDraft = null;
    return null;
  }

  try {
    const draftRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'drafts', user.uid);
    const snap = await getDoc(draftRef);
    if (snap.exists()) {
      cachedDraft = snap.data();
      return cachedDraft;
    }
  } catch (err) {
    console.error('Draft Firestore load failed:', err);
  }

  const storageKey = getDraftStorageKey();
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        cachedDraft = JSON.parse(raw);
        return cachedDraft;
      }
    } catch (_) { /* ignore */ }
  }

  cachedDraft = null;
  return null;
};

const clearInterviewDraft = async () => {
  cachedDraft = null;
  const storageKey = getDraftStorageKey();
  if (storageKey) {
    try { localStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
  }
  if (currentWorkspace && user) {
    try {
      await deleteDoc(doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'drafts', user.uid));
    } catch (_) { /* ignore */ }
  }
  renderDraftBanner();
};

const renderDraftBanner = () => {
  if (!draftResumeBanner) return;
  if (!cachedDraft?.templateSnapshot) {
    draftResumeBanner.classList.add('hidden');
    return;
  }

  const name = cachedDraft.candidateName?.trim() || 'Unnamed candidate';
  const tpl = cachedDraft.templateSnapshot.title || 'Interview';
  const saved = cachedDraft.savedAt ? new Date(cachedDraft.savedAt).toLocaleString() : '';

  draftResumeSummary.textContent = `${name} — ${tpl}`;
  draftResumeMeta.textContent = saved ? `Last saved ${saved}` : 'Auto-saved draft available';
  draftResumeBanner.classList.remove('hidden');
};

const bindLiveInterviewAutosave = () => {
  if (liveInterviewAutosaveBound) return;
  const liveForm = document.getElementById('live-interview-form');
  const notepadAside = document.getElementById('evaluator-notepad-aside');
  if (!liveForm) return;
  liveInterviewAutosaveBound = true;

  const onAutosave = () => scheduleDraftSave();
  liveForm.addEventListener('input', onAutosave);
  liveForm.addEventListener('change', onAutosave);
  liveForm.addEventListener('click', (event) => {
    if (event.target.closest('.rating-btn, .likert-btn, .btn-score-select, .btn-likert-choice')) onAutosave();
  });
  notepadAside?.addEventListener('input', onAutosave);
};

const restoreInterviewFromDraft = (draft) => {
  activeInterviewTemplate = {
    id: draft.templateSnapshot.id,
    title: draft.templateSnapshot.title,
    role: draft.templateSnapshot.role,
    description: draft.templateSnapshot.description,
    criteria: draft.templateSnapshot.criteria || []
  };

  document.getElementById('candidate-name').value = draft.candidateName || '';
  document.getElementById('candidate-role').value = draft.candidateRole || activeInterviewTemplate.role || '';
  document.getElementById('interviewer-name').value = draft.interviewerName || '';
  document.getElementById('date-of-interview').value = draft.dateOfInterview || new Date().toISOString().split('T')[0];
  document.getElementById('candidate-strengths').value = draft.strengths || '';
  document.getElementById('candidate-weaknesses').value = draft.weaknesses || '';
  document.getElementById('overall-feedback').value = draft.overallFeedback || '';
  document.getElementById('local-scratchpad').value = draft.scratchpad || '';

  candidateScores = { ...(draft.candidateScores || {}) };
  candidateNotes = { ...(draft.candidateNotes || {}) };
  likertResponses = { ...(draft.likertResponses || {}) };
  interviewDuration = draft.durationSeconds || 0;

  clearInterval(timerInterval);
  updateLiveTimerDisplay(interviewDuration);
  timerInterval = setInterval(() => {
    interviewDuration++;
    updateLiveTimerDisplay(interviewDuration);
    if (interviewDuration % 30 === 0) scheduleDraftSave();
  }, 1000);

  navActiveCandidateName.textContent = draft.candidateName?.trim() || 'Draft interview';
  navActiveAssessmentContainer.classList.remove('hidden');
  loadSoloRoster();
  setSoloRosterUIVisible(true);
  if (draft.candidateName?.trim()) syncSoloRosterCurrentFromName(draft.candidateName.trim());
  renderLiveInterviewSheet();
  bindLiveInterviewAutosave();
  switchTab('live-interview');
};

const resumeInterviewDraft = async () => {
  const draft = cachedDraft || await loadInterviewDraft();
  if (!draft?.templateSnapshot) {
    showToast('No draft found to resume.', 'error');
    return;
  }
  if (activeInterviewTemplate && !window.confirm('Replace your current interview with the saved draft?')) return;
  restoreInterviewFromDraft(draft);
  showToast('Draft restored — continue where you left off.', 'info');
};

const discardInterviewDraft = async () => {
  if (!window.confirm('Discard this saved draft permanently?')) return;
  await clearInterviewDraft();
  showToast('Draft discarded.');
};

const buildScorecardHtml = (cand, criteria) => {
  const category = getPerformerCategory(cand.calculatedScore);
  const breakdown = computeScoreBreakdown(cand.scores || {}, criteria, cand.likertAnswers || {});
  const logoUrl = new URL('photoes/logo.png', window.location.href).href;
  const evalDate = cand.date || (cand.evaluatedAt ? new Date(cand.evaluatedAt).toLocaleDateString() : '—');

  let criteriaHtml = criteria.map((crit) => {
    const rate = (cand.scores || {})[crit.id] || '—';
    const note = (cand.notes || {})[crit.id] || '';
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(crit.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:bold;">${escapeHtml(rate)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${escapeHtml(note || '—')}</td>
      </tr>`;
  }).join('');

  let likertHtml = MANDATORY_LIKERT_QUESTIONS.map((q, idx) => {
    const ans = (cand.likertAnswers || {})[q.id] || '—';
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${idx + 1}. ${escapeHtml(q.text)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(ans)}</td>
      </tr>`;
  }).join('');

  const breakdownNote = breakdown.likertsAnswered === 0
    ? 'Final score based on criteria only (no checklist responses).'
    : `Weighted: Criteria ${Math.round(breakdown.criteriaWeight * 100)}% (${breakdown.criteriaScore}%) + Checklist ${Math.round(breakdown.likertWeight * 100)}% (${breakdown.likertScore}%)`;

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;padding:32px;max-width:800px;">
      <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:24px;">
        <img src="${logoUrl}" alt="Logo" style="height:48px;width:auto;" />
        <div>
          <h1 style="margin:0;font-size:22px;font-weight:800;">TalentCalibrate</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Interview Evaluation Scorecard</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Candidate</strong><p style="margin:4px 0 0;font-size:16px;font-weight:700;">${escapeHtml(cand.name)}</p></div>
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Position</strong><p style="margin:4px 0 0;">${escapeHtml(cand.role || '—')}</p></div>
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Interviewer</strong><p style="margin:4px 0 0;">${escapeHtml(cand.interviewer || '—')}</p></div>
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Interview Date</strong><p style="margin:4px 0 0;">${escapeHtml(cand.date || '—')}</p></div>
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Template</strong><p style="margin:4px 0 0;">${escapeHtml(cand.templateTitle || '—')}</p></div>
        <div><strong style="font-size:11px;color:#64748b;text-transform:uppercase;">Duration</strong><p style="margin:4px 0 0;">${escapeHtml(formatDuration(cand.durationSeconds))}</p></div>
      </div>

      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#eef2ff;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#4338ca;font-weight:700;text-transform:uppercase;">Final Score</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;">${cand.calculatedScore}%</p>
        </div>
        <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#166534;font-weight:700;text-transform:uppercase;">Category</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:800;">${escapeHtml(category.label)}</p>
        </div>
      </div>

      <p style="font-size:11px;color:#64748b;margin-bottom:24px;">${breakdownNote}</p>

      <h2 style="font-size:13px;font-weight:800;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Rating Criteria</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px;text-align:left;">Criterion</th>
          <th style="padding:8px;text-align:center;">Rating</th>
          <th style="padding:8px;text-align:left;">Notes</th>
        </tr></thead>
        <tbody>${criteriaHtml}</tbody>
      </table>

      <h2 style="font-size:13px;font-weight:800;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Feedback Checklist</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
        <tbody>${likertHtml}</tbody>
      </table>

      <h2 style="font-size:13px;font-weight:800;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Qualitative Summary</h2>
      <div style="margin-bottom:12px;"><strong style="font-size:11px;">Strengths</strong><p style="margin:4px 0 0;font-size:12px;white-space:pre-wrap;">${escapeHtml(cand.strengths || '—')}</p></div>
      <div style="margin-bottom:12px;"><strong style="font-size:11px;">Weaknesses</strong><p style="margin:4px 0 0;font-size:12px;white-space:pre-wrap;">${escapeHtml(cand.weaknesses || '—')}</p></div>
      <div style="margin-bottom:24px;"><strong style="font-size:11px;">Overall Verdict</strong><p style="margin:4px 0 0;font-size:12px;white-space:pre-wrap;">${escapeHtml(cand.overallFeedback || '—')}</p></div>

      <div style="border-top:1px solid #e2e8f0;padding-top:24px;margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
        <div>
          <p style="margin:0 0 32px;font-size:11px;color:#64748b;">Interviewer Signature</p>
          <div style="border-bottom:1px solid #94a3b8;"></div>
          <p style="margin:8px 0 0;font-size:11px;">${escapeHtml(cand.interviewer || '')}</p>
        </div>
        <div>
          <p style="margin:0 0 32px;font-size:11px;color:#64748b;">Date</p>
          <div style="border-bottom:1px solid #94a3b8;"></div>
          <p style="margin:8px 0 0;font-size:11px;">${escapeHtml(evalDate)}</p>
        </div>
      </div>
    </div>`;
};

const buildScorecardDocumentHtml = (cand, criteria) => {
  const body = buildScorecardHtml(cand, criteria);
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scorecard - ${escapeHtml(cand.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  @media print { body { padding: 8px; } }
</style>
</head><body>${body}</body></html>`;
};

const printScorecardViaIframe = (cand, criteria) => {
  const docHtml = buildScorecardDocumentHtml(cand, criteria);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;background:#fff;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    showToast('Could not open print preview.', 'error');
    return;
  }

  doc.open();
  doc.write(docHtml);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error(err);
      const popup = window.open('', '_blank');
      if (popup) {
        popup.document.write(docHtml);
        popup.document.close();
        popup.onload = () => popup.print();
      } else {
        showToast('Allow pop-ups to print the scorecard.', 'error');
      }
    }
    cleanup();
  };

  if (iframe.contentWindow?.document?.readyState === 'complete') {
    setTimeout(runPrint, 250);
  } else {
    iframe.onload = () => setTimeout(runPrint, 250);
    setTimeout(runPrint, 600);
  }
};

const printCandidateScorecard = (cand) => {
  const criteria = getCandidateCriteria(cand);
  printScorecardViaIframe(cand, criteria);
};

const downloadCandidatePdf = async (cand) => {
  const criteria = getCandidateCriteria(cand);

  if (isMobileDevice()) {
    printCandidateScorecard(cand);
    showToast('Choose "Save as PDF" in the print dialog.', 'info');
    return;
  }

  try {
    await loadScript(SCRIPT_URLS.html2pdf);
  } catch (_) {
    printCandidateScorecard(cand);
    showToast('PDF library unavailable — use Print instead.', 'info');
    return;
  }

  if (typeof html2pdf === 'undefined') {
    printCandidateScorecard(cand);
    return;
  }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;width:800px;background:#fff;z-index:-1;opacity:0;pointer-events:none;';
  container.innerHTML = buildScorecardHtml(cand, criteria);
  document.body.appendChild(container);
  const slug = (cand.name || 'candidate').replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    await html2pdf().set({
      margin: 10,
      filename: `Scorecard_${slug}.pdf`,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 1.5, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save();
    showToast('PDF downloaded successfully.');
  } catch (err) {
    console.error(err);
    printCandidateScorecard(cand);
    showToast('PDF export failed — opened print dialog instead.', 'error');
  } finally {
    container.remove();
  }
};

const renderCandidateDetailContent = () => {
  if (!viewingCandidate || !candidateDetailBody) return;

  const cand = viewingCandidate;
  const criteria = getCandidateCriteria(cand);
  const category = getPerformerCategory(cand.calculatedScore);
  const breakdown = computeScoreBreakdown(cand.scores || {}, criteria, cand.likertAnswers || {});

  candidateDetailTitle.textContent = cand.name || 'Candidate';
  candidateDetailSubtitle.textContent = `${cand.role || 'No role'} · ${cand.interviewer || '—'} · ${cand.date || 'No date'}`;

  const breakdownHtml = breakdown.likertsAnswered === 0
    ? `<p class="text-[10px] text-slate-500 mt-2">Score based on criteria ratings only.</p>`
    : `<p class="text-[10px] text-slate-500 mt-2">(${breakdown.criteriaScore}% × 60%) + (${breakdown.likertScore}% × 40%)</p>`;

  const criteriaRows = criteria.map((crit) => {
    const rate = (cand.scores || {})[crit.id] || '';
    const note = (cand.notes || {})[crit.id] || '';
    if (candidateDetailEditMode) {
      return `
        <div class="detail-criteria-row">
          <span class="text-xs font-bold text-slate-800">${escapeHtml(crit.name)}</span>
          <div class="flex flex-wrap gap-1 mt-1">
            ${['NS', 'S', 'VS', 'NA'].map((r) => `
              <button type="button" data-crit-id="${crit.id}" data-rate="${r}"
                class="detail-edit-rate px-2 py-1 text-[10px] font-bold rounded-full border ${rate === r ? getRateBadgeClass(r) : 'bg-white border-slate-200'}">${r}</button>
            `).join('')}
          </div>
          <input type="text" class="detail-edit-input mt-1 detail-edit-note" data-crit-id="${crit.id}" value="${escapeHtml(note)}" placeholder="Notes for this criterion" />
        </div>`;
    }
    return `
      <div class="detail-criteria-row">
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-bold text-slate-800">${escapeHtml(crit.name)}</span>
          <span class="detail-rate-badge ${getRateBadgeClass(rate || 'NA')}">${escapeHtml(rate || '—')}</span>
        </div>
        ${note ? `<p class="text-[10px] text-slate-500 mt-1">${escapeHtml(note)}</p>` : ''}
      </div>`;
  }).join('');

  const likertRows = MANDATORY_LIKERT_QUESTIONS.map((q, idx) => {
    const ans = (cand.likertAnswers || {})[q.id] || '';
    if (candidateDetailEditMode) {
      return `
        <div class="detail-likert-row">
          <span class="text-xs text-slate-800">${idx + 1}. ${escapeHtml(q.text)}</span>
          <select class="detail-edit-select detail-edit-likert mt-1" data-likert-id="${q.id}">
            <option value="">—</option>
            ${['Strongly Agree', 'Agree', 'Disagree', 'Could not determine'].map((c) => `
              <option value="${c}" ${ans === c ? 'selected' : ''}>${c}</option>
            `).join('')}
          </select>
        </div>`;
    }
    return `
      <div class="detail-likert-row">
        <span class="text-xs text-slate-700">${idx + 1}. ${escapeHtml(q.text)}</span>
        <span class="text-xs font-semibold text-indigo-700 mt-0.5">${escapeHtml(ans || '—')}</span>
      </div>`;
  }).join('');

  const metaFields = candidateDetailEditMode ? `
    <div class="grid gap-3 sm:grid-cols-2 mb-4">
      <div><label class="text-[10px] font-bold text-slate-500 uppercase">Interviewer</label>
        <input type="text" id="detail-edit-interviewer" class="detail-edit-input mt-1" value="${escapeHtml(cand.interviewer || '')}" /></div>
      <div><label class="text-[10px] font-bold text-slate-500 uppercase">Interview Date</label>
        <input type="date" id="detail-edit-date" class="detail-edit-input mt-1" value="${escapeHtml(cand.date || '')}" /></div>
    </div>` : '';

  const qualFields = candidateDetailEditMode ? `
    <textarea id="detail-edit-strengths" class="detail-edit-textarea mb-2" placeholder="Strengths">${escapeHtml(cand.strengths || '')}</textarea>
    <textarea id="detail-edit-weaknesses" class="detail-edit-textarea mb-2" placeholder="Weaknesses">${escapeHtml(cand.weaknesses || '')}</textarea>
    <textarea id="detail-edit-feedback" class="detail-edit-textarea" placeholder="Overall verdict">${escapeHtml(cand.overallFeedback || '')}</textarea>
  ` : `
    <p class="text-xs text-slate-700"><strong>Strengths:</strong> ${escapeHtml(cand.strengths || '—')}</p>
    <p class="text-xs text-slate-700 mt-2"><strong>Weaknesses:</strong> ${escapeHtml(cand.weaknesses || '—')}</p>
    <p class="text-xs text-slate-700 mt-2"><strong>Verdict:</strong> ${escapeHtml(cand.overallFeedback || '—')}</p>
  `;

  candidateDetailBody.innerHTML = `
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <span class="inline-block px-3 py-1 rounded-full border text-xs font-bold ${category.color}">${category.label}</span>
      <span class="text-lg font-black text-slate-900">${cand.calculatedScore}%</span>
      <span class="text-[10px] text-slate-400">${escapeHtml(cand.templateTitle || '')}</span>
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Score Breakdown</p>
      <div class="detail-score-breakdown">
        <div class="detail-score-card bg-indigo-50 border-indigo-200">
          <p class="text-[10px] font-bold text-indigo-600 uppercase">Criteria</p>
          <p class="text-xl font-black text-indigo-900">${breakdown.criteriaScore}%</p>
          <p class="text-[10px] text-indigo-500">${breakdown.likertsAnswered ? '60% weight' : '100% weight'}</p>
        </div>
        <div class="detail-score-card bg-violet-50 border-violet-200">
          <p class="text-[10px] font-bold text-violet-600 uppercase">Checklist</p>
          <p class="text-xl font-black text-violet-900">${breakdown.likertsAnswered ? `${breakdown.likertScore}%` : '—'}</p>
          <p class="text-[10px] text-violet-500">${breakdown.likertsAnswered ? '40% weight' : 'Not answered'}</p>
        </div>
        <div class="detail-score-card bg-emerald-50 border-emerald-200">
          <p class="text-[10px] font-bold text-emerald-600 uppercase">Final</p>
          <p class="text-xl font-black text-emerald-900">${breakdown.finalScore}%</p>
        </div>
      </div>
      ${breakdownHtml}
    </div>

    ${metaFields}

    <div class="detail-section">
      <p class="detail-section-title">Rating Criteria</p>
      ${criteriaRows}
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Feedback Checklist</p>
      ${likertRows}
    </div>

    <div class="detail-section">
      <p class="detail-section-title">Qualitative Summary</p>
      ${qualFields}
    </div>
  `;

  if (candidateDetailEditMode) {
    candidateDetailBody.querySelectorAll('.detail-edit-rate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const critId = btn.dataset.critId;
        const rate = btn.dataset.rate;
        if (!viewingCandidate.scores) viewingCandidate.scores = {};
        viewingCandidate.scores[critId] = rate;
        renderCandidateDetailContent();
      });
    });
  }

  btnCandidateEditToggle.textContent = candidateDetailEditMode ? 'Cancel Edit' : 'Edit Record';
  btnCandidateSave.classList.toggle('hidden', !candidateDetailEditMode);
};

const openCandidateDetail = (cand) => {
  viewingCandidate = { ...cand, scores: { ...(cand.scores || {}) }, notes: { ...(cand.notes || {}) }, likertAnswers: { ...(cand.likertAnswers || {}) } };
  candidateDetailEditMode = false;
  renderCandidateDetailContent();
  candidateDetailModal?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

const closeCandidateDetail = () => {
  candidateDetailModal?.classList.add('hidden');
  document.body.style.overflow = '';
  viewingCandidate = null;
  candidateDetailEditMode = false;
};

const saveCandidateDetailEdits = async () => {
  if (!viewingCandidate?.id || !currentWorkspace) return;

  if (candidateDetailEditMode) {
    viewingCandidate.interviewer = document.getElementById('detail-edit-interviewer')?.value.trim() || '—';
    viewingCandidate.date = document.getElementById('detail-edit-date')?.value || '';
    viewingCandidate.strengths = document.getElementById('detail-edit-strengths')?.value || '';
    viewingCandidate.weaknesses = document.getElementById('detail-edit-weaknesses')?.value || '';
    viewingCandidate.overallFeedback = document.getElementById('detail-edit-feedback')?.value || '';

    candidateDetailBody.querySelectorAll('.detail-edit-note').forEach((input) => {
      if (!viewingCandidate.notes) viewingCandidate.notes = {};
      viewingCandidate.notes[input.dataset.critId] = input.value;
    });

    candidateDetailBody.querySelectorAll('.detail-edit-likert').forEach((select) => {
      if (!viewingCandidate.likertAnswers) viewingCandidate.likertAnswers = {};
      viewingCandidate.likertAnswers[select.dataset.likertId] = select.value;
    });
  }

  const criteria = getCandidateCriteria(viewingCandidate);
  viewingCandidate.calculatedScore = computeScoreBreakdown(
    viewingCandidate.scores,
    criteria,
    viewingCandidate.likertAnswers
  ).finalScore;

  try {
    const docRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates', viewingCandidate.id);
    await updateDoc(docRef, {
      interviewer: viewingCandidate.interviewer,
      date: viewingCandidate.date,
      scores: viewingCandidate.scores,
      notes: viewingCandidate.notes,
      likertAnswers: viewingCandidate.likertAnswers,
      strengths: viewingCandidate.strengths,
      weaknesses: viewingCandidate.weaknesses,
      overallFeedback: viewingCandidate.overallFeedback,
      calculatedScore: viewingCandidate.calculatedScore,
      updatedAt: new Date().toISOString()
    });
    showToast('Evaluation updated successfully.');
    candidateDetailEditMode = false;
    renderCandidateDetailContent();
    renderAnalytics();
  } catch (err) {
    console.error(err);
    showToast('Could not save changes.', 'error');
  }
};

const renderTemplates = () => {
  if (!templatesGrid) return;
  templatesGrid.innerHTML = '';

  if (templates.length === 0) {
    templatesGrid.innerHTML = `
      <div class="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/80 p-12 text-center col-span-full shadow-lg">
        <div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-2xl">📋</div>
        <h3 class="text-md font-bold text-slate-900 mb-1">No rubrics yet</h3>
        <p class="text-sm text-slate-500 mb-6 max-w-sm mx-auto">Create your first evaluation template to start scoring candidates. You can use the built-in 6-criteria standard or customize your own.</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <button id="btn-create-standard-tpl" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition shadow-lg">Use Standard 6-Criteria Rubric</button>
          <button id="btn-create-custom-tpl" class="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-5 py-2.5 rounded-full transition">Build Custom Template</button>
        </div>
      </div>
    `;
    document.getElementById('btn-create-standard-tpl')?.addEventListener('click', createStandardTemplate);
    document.getElementById('btn-create-custom-tpl')?.addEventListener('click', () => {
      editingTemplateId = null;
      resetFormBuilderDefaults();
      switchTab('form-builder');
    });
    renderDraftBanner();
    return;
  }

  templates.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = 'bg-white/70 backdrop-blur-xl hover:bg-white/90 transition-all duration-300 p-5 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col justify-between group cursor-default';

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
      <div class="border-t border-slate-200/50 pt-4 mt-6 flex justify-between items-center opacity-90 group-hover:opacity-100 transition-opacity">
        <div class="flex space-x-1">
          <button class="btn-edit-tpl p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="Edit template fields">✎</button>
          <button class="btn-delete-tpl p-2 text-rose-500 hover:bg-rose-50 rounded-full" title="Delete template">🗑</button>
        </div>
        <button class="btn-panel-mode rounded-full border border-violet-300 bg-violet-50 text-violet-800 text-xs font-bold px-3 py-2 hover:bg-violet-100 transition" title="Multi-evaluator panel with share code">Panel Mode</button>
        <button class="btn-launch-interview bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-full transition shadow-sm">Solo Interview</button>
      </div>
    `;

    card.querySelector('.btn-edit-tpl').addEventListener('click', () => triggerEditTemplate(tpl));
    card.querySelector('.btn-delete-tpl').addEventListener('click', () => handleDeleteTemplate(tpl.id));
    card.querySelector('.btn-launch-interview').addEventListener('click', () => handleStartInterview(tpl));
    card.querySelector('.btn-panel-mode').addEventListener('click', () => openPanelCreateModal(tpl));

    templatesGrid.appendChild(card);
  });

  renderDraftBanner();
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

  activeInterviewTemplate.criteria.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'criteria-card';
    row.innerHTML = `
      <div class="criteria-card__header">
        <div class="criteria-card__meta">
          <span class="criteria-card__num">${idx + 1}</span>
          <div class="criteria-card__text">
            <input type="text" class="live-crit-name-input"
              value="${escapeHtml(c.name)}" placeholder="Criteria name" title="Click to rename criteria">
            <textarea class="live-crit-desc-input" rows="2" placeholder="Explain expectations or what to observe in the interview…" title="Guidance for evaluators">${escapeHtml(c.desc || '')}</textarea>
          </div>
        </div>
        <div class="criteria-card__actions">
          <label class="criteria-card__weight-wrap">
            <span class="font-bold text-[9px] uppercase tracking-wider text-slate-400">Weight</span>
            <input type="number" class="live-crit-weight-input" min="0" max="100" value="${c.weight}" title="Criteria weight %" aria-label="Weight percentage">
            <span>%</span>
          </label>
          <button type="button" class="btn-delete-live-crit flex h-8 w-8 items-center justify-center text-rose-600 hover:bg-rose-50 rounded-full border border-rose-200 transition font-bold text-sm" title="Remove this criterion" aria-label="Remove criterion">✕</button>
        </div>
      </div>

      <div class="criteria-card__ratings">
        <span class="criteria-card__ratings-label">Select a rating</span>
        <div class="rating-btn-group" role="group" aria-label="Rating for ${escapeHtml(c.name)}">
          ${[
            { rate: 'NS', label: 'Not Satisfactory'  },
            { rate: 'S',  label: 'Satisfactory'      },
            { rate: 'VS', label: 'Very Satisfactory'  },
            { rate: 'NA', label: 'Not Applicable'    }
          ].map(({ rate, label }) => `
            <button type="button" data-rate="${rate}"
              class="rating-btn rating-btn--${rate.toLowerCase()} ${candidateScores[c.id] === rate ? 'is-selected' : ''}"
              title="${label}" aria-label="${label}">
              <span class="rating-btn__abbr">${rate}</span>
              <span class="rating-btn__sep" aria-hidden="true">·</span>
              <span class="rating-btn__label">${label}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="criteria-card__note">
        <label class="criteria-note-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Comments to support this rating
        </label>
        <input type="text" class="input-comment criteria-note-input"
          placeholder="Describe what you observed…"
          value="${candidateNotes[c.id] || ''}">
      </div>
    `;

    row.querySelector('.live-crit-name-input').addEventListener('input', (e) => {
      c.name = e.target.value;
    });

    row.querySelector('.live-crit-desc-input').addEventListener('input', (e) => {
      c.desc = e.target.value;
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    });
    const descEl = row.querySelector('.live-crit-desc-input');
    if (descEl) {
      descEl.style.height = 'auto';
      descEl.style.height = `${descEl.scrollHeight}px`;
    }

    row.querySelector('.live-crit-weight-input').addEventListener('input', (e) => {
      c.weight = Number(e.target.value || 0);
      updateLiveComputedScore();
    });

    row.querySelector('.btn-delete-live-crit').addEventListener('click', () => {
      if (activeInterviewTemplate.criteria.length <= 1) {
        showToast('You must keep at least one assessment criteria.', 'error');
        return;
      }
      activeInterviewTemplate.criteria.splice(idx, 1);
      renderLiveInterviewSheet();
    });

    row.querySelector('.criteria-note-input').addEventListener('input', (e) => {
      candidateNotes[c.id] = e.target.value;
    });

    row.querySelectorAll('.rating-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedRate = btn.getAttribute('data-rate');
        candidateScores[c.id] = selectedRate;
        row.querySelectorAll('.rating-btn').forEach((s) => s.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        updateLiveComputedScore();
      });
    });

    criteriaContainer.appendChild(row);
  });

  const liveAddBtn = document.getElementById('btn-live-add-criteria');
  if (liveAddBtn && !liveAddBtn.dataset.bound) {
    liveAddBtn.dataset.bound = "true";
    liveAddBtn.addEventListener('click', () => {
      const newId = `crit-live-${Date.now()}`;
      activeInterviewTemplate.criteria.push({
        id: newId,
        name: `Custom Focus Field ${activeInterviewTemplate.criteria.length + 1}`,
        category: 'Custom Skill',
        maxScore: 3,
        weight: 10,
        desc: ''
      });
      candidateNotes[newId] = '';
      candidateScores[newId] = '';
      renderLiveInterviewSheet();
    });
  }

  const likertContainer = document.getElementById('live-likert-questions-container');
  likertContainer.innerHTML = '';
  MANDATORY_LIKERT_QUESTIONS.forEach((q, idx) => {
    const block = document.createElement('div');
    block.className = 'likert-card';
    block.innerHTML = `
      <div class="likert-card__question">
        <span class="likert-card__num">${idx + 1}</span>
        <p class="likert-card__text">${q.text}</p>
      </div>
      <div class="likert-choice-group">
        ${[
          { choice: 'Strongly Agree',       icon: '✓✓', mod: 'sa' },
          { choice: 'Agree',                icon: '✓',  mod: 'a'  },
          { choice: 'Disagree',             icon: '✕',  mod: 'd'  },
          { choice: 'Could not determine',  icon: '?',  mod: 'nd' }
        ].map(({ choice, icon, mod }) => `
          <button type="button" data-choice="${choice}"
            class="likert-btn likert-btn--${mod} ${likertResponses[q.id] === choice ? 'is-selected' : ''}"
            aria-label="${choice}">
            <span class="likert-btn__icon" aria-hidden="true">${icon}</span>
            <span class="likert-btn__label">${choice}</span>
          </button>
        `).join('')}
      </div>
    `;

    block.querySelectorAll('.likert-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selectedChoice = btn.getAttribute('data-choice');
        likertResponses[q.id] = selectedChoice;
        block.querySelectorAll('.likert-btn').forEach((s) => s.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        updateLiveComputedScore();
      });
    });

    likertContainer.appendChild(block);
  });
  updateLiveComputedScore();
};

const getRateClass = (rate) => {
  if (rate === 'VS') return 'bg-emerald-600 text-white border-emerald-700 shadow-sm';
  if (rate === 'S')  return 'bg-indigo-600 text-white border-indigo-700 shadow-sm';
  if (rate === 'NS') return 'bg-rose-600 text-white border-rose-700 shadow-sm';
  return 'bg-slate-700 text-white border-slate-800 shadow-sm';
};

const getLikertClass = (choice) => {
  if (choice === 'Strongly Agree')      return 'bg-emerald-100 border-emerald-500 text-emerald-800 font-bold';
  if (choice === 'Agree')               return 'bg-indigo-100 border-indigo-500 text-indigo-800 font-bold';
  if (choice === 'Disagree')            return 'bg-rose-100 border-rose-500 text-rose-800 font-bold';
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

  const filtered = getFilteredCandidates();

  const topT = filtered.filter((c) => c.calculatedScore >= scoreThresholds.high);
  const midT = filtered.filter((c) => c.calculatedScore >= scoreThresholds.low && c.calculatedScore < scoreThresholds.high);
  const lowT = filtered.filter((c) => c.calculatedScore < scoreThresholds.low);

  renderDistributionChart(filtered, topT, midT, lowT);
  candidatesTableBody.innerHTML = '';

  if (filtered.length === 0) {
    const emptyMsg = candidates.length === 0
      ? 'No evaluations yet. Complete a live interview to see results here.'
      : 'No candidates match your search or filter.';
    candidatesTableBody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-xs text-slate-400">${emptyMsg}</td></tr>`;
    renderDistributionChart([], [], [], []);
    if (dashboardVisible) renderAnalyticsDashboard();
    return;
  }

  filtered.forEach((cand) => {
    const category = getPerformerCategory(cand.calculatedScore);
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50/70 transition-colors border-b border-slate-100 group';
    row.innerHTML = `
      <td class="p-4">
        <span class="font-semibold text-slate-900 block text-sm leading-tight">${escapeHtml(cand.name)}</span>
        <span class="text-[11px] text-slate-400 mt-0.5 block">${escapeHtml(cand.role || '—')}</span>
        ${cand.isPanelEvaluation ? '<span class="inline-block mt-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-700">Panel avg</span>' : ''}
      </td>
      <td class="p-4">
        <span class="font-medium text-slate-700 block text-sm leading-tight">${cand.interviewer || '—'}</span>
        <span class="text-[11px] text-slate-400 mt-0.5 block">${cand.date || 'No date'}</span>
      </td>
      <td class="p-4">
        <span class="font-black text-slate-900 text-sm tabular-nums">${cand.calculatedScore}%</span>
      </td>
      <td class="p-4">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide ${category.color}">${category.label}</span>
      </td>
      <td class="p-4 max-w-[140px]">
        <span class="block truncate text-xs text-slate-600" title="${cand.strengths || '—'}">${cand.strengths || '—'}</span>
      </td>
      <td class="p-4 max-w-[140px]">
        <span class="block truncate text-xs text-slate-600" title="${cand.weaknesses || '—'}">${cand.weaknesses || '—'}</span>
      </td>
      <td class="p-4 text-right">
        <div class="inline-flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <!-- View -->
          <button class="btn-view-cand action-btn action-btn--indigo" title="View full evaluation" aria-label="View evaluation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <!-- Print -->
          <button class="btn-print-cand action-btn action-btn--slate" title="Print scorecard" aria-label="Print scorecard">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
          </button>
          <!-- PDF -->
          <button class="btn-pdf-cand action-btn action-btn--violet" title="Download PDF" aria-label="Download PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </button>
          <!-- Copy -->
          <button class="btn-copy-report action-btn action-btn--slate" title="Copy report to clipboard" aria-label="Copy report">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <!-- Delete -->
          <button class="btn-delete-cand action-btn action-btn--rose" title="Delete evaluation" aria-label="Delete evaluation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    row.querySelector('.btn-view-cand').addEventListener('click', () => openCandidateDetail(cand));
    row.querySelector('.btn-print-cand').addEventListener('click', () => printCandidateScorecard(cand));
    row.querySelector('.btn-pdf-cand').addEventListener('click', () => downloadCandidatePdf(cand));
    row.querySelector('.btn-copy-report').addEventListener('click', () => {
      const text = `Candidate Report: ${cand.name}\nOverall Grade: ${cand.calculatedScore}%\nVerdict: ${category.label}\nStrengths: ${cand.strengths}\nWeaknesses: ${cand.weaknesses}\nAdditional Comments: ${cand.overallFeedback}`;
      navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : document.execCommand('copy');
      showToast('Detailed scorecard report copied to clipboard!');
    });

    row.querySelector('.btn-delete-cand').addEventListener('click', () => { handleDeleteCandidate(cand.id); });
    candidatesTableBody.appendChild(row);
  });

  if (dashboardVisible) renderAnalyticsDashboard();
};

const renderDistributionChart = (filteredList, topT, midT, lowT) => {
  distributionChartWrapper.innerHTML = '';
  if (filteredList.length === 0) {
    distributionChartWrapper.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Complete interviews to see performance distribution.</p>`;
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
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-3xl text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Top tier (${topT.length} candidates)
      </div>
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-3xl text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        Mid tier (${midT.length} candidates)
      </div>
      <div class="p-3 bg-rose-50 border border-rose-200 rounded-3xl text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Low tier (${lowT.length} candidates)
      </div>
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
    await deleteDoc(doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'templates', id));
    showToast('Template removed successfully.');
  } catch (err) {
    showToast('Deletion error.', 'error');
  }
};

templateEditorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user || !currentWorkspace) {
    showToast('Sign in to a workspace before saving.', 'error');
    return;
  }

  const weightSum = builderCriteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  if (weightSum !== 100) {
    showToast(`Criteria weights must total 100% (currently ${weightSum}%).`, 'error');
    return;
  }

  if (builderCriteria.some(c => !c.name?.trim())) {
    showToast('Every criteria needs a name before publishing.', 'error');
    return;
  }

  const title = document.getElementById('tpl-title').value.trim();
  if (!title) {
    showToast('Please enter a form title.', 'error');
    return;
  }

  const templateData = {
    title,
    description: document.getElementById('tpl-desc').value.trim(),
    role: document.getElementById('tpl-role').value.trim(),
    criteria: builderCriteria,
    updatedAt: new Date().toISOString(),
    creator: user.uid
  };

  try {
    if (editingTemplateId) {
      const docRef = doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'templates', editingTemplateId);
      await updateDoc(docRef, templateData);
      showToast('Rubric form template updated successfully!');
    } else {
      const collectionRef = collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'templates');
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
  if (cachedDraft?.templateSnapshot && !window.confirm('Starting a new interview will replace your saved draft on next auto-save. Continue?')) return;

  activePanelId = null;
  activePanel = null;
  activePanelCandidateId = null;
  activePanelCandidate = null;

  activeInterviewTemplate = template;
  setLiveInterviewPanelUI(false);

  document.getElementById('candidate-name').value = '';
  document.getElementById('candidate-role').value = template.role || '';
  document.getElementById('interviewer-name').value = '';
  document.getElementById('date-of-interview').value = new Date().toISOString().split('T')[0];

  candidateScores = {};
  candidateNotes = {};
  template.criteria.forEach((c) => {
    candidateNotes[c.id] = '';
  });

  likertResponses = {};

  document.getElementById('candidate-strengths').value = '';
  document.getElementById('candidate-weaknesses').value = '';
  document.getElementById('overall-feedback').value = '';
  document.getElementById('local-scratchpad').value = '';
  interviewDuration = 0;
  clearInterval(timerInterval);
  updateLiveTimerDisplay(0);
  timerInterval = setInterval(() => {
    interviewDuration++;
    updateLiveTimerDisplay(interviewDuration);
  }, 1000);

  navActiveCandidateName.textContent = 'New interview';
  navActiveAssessmentContainer.classList.remove('hidden');
  loadSoloRoster();
  setSoloRosterUIVisible(true);
  const rosterPick = soloRosterQueue.find((c) => c.status === 'current') || soloRosterQueue.find((c) => c.status === 'pending');
  if (rosterPick) {
    selectSoloRosterCandidate(soloRosterQueue.indexOf(rosterPick), { force: true });
  } else {
    renderLiveInterviewSheet();
  }
  bindLiveInterviewAutosave();
  switchTab('live-interview');
};

const updateLiveTimerDisplay = (seconds) => {
  const formatted = getFormattedTime(seconds);
  document.querySelectorAll('.live-duration-text').forEach((el) => { el.textContent = formatted; });
};

document.getElementById('candidate-name').addEventListener('input', (event) => {
  const name = event.target.value.trim();
  navActiveCandidateName.textContent = name || 'New interview';
  if (!isPanelModeActive()) syncSoloRosterCurrentFromName(name);
});

document.getElementById('btn-cancel-interview').addEventListener('click', async () => {
  const msg = isPanelModeActive()
    ? 'Leave your scorecard? Progress is saved as a draft in this panel session.'
    : 'Leave this interview? Your progress is auto-saved as a draft you can resume later.';
  if (!window.confirm(msg)) return;
  await saveInterviewDraft();
  const keepPanel = isPanelModeActive();
  cleanupActiveInterview(false, keepPanel);
  if (keepPanel && activePanelId) openPanelHub(activePanelId);
});

const cleanupActiveInterview = (silent = false, keepPanelSession = false) => {
  clearInterval(timerInterval);
  timerInterval = null;
  clearTimeout(draftSaveTimer);
  activeInterviewTemplate = null;
  candidateScores = {};
  candidateNotes = {};
  likertResponses = {};
  interviewDuration = 0;
  navActiveAssessmentContainer.classList.add('hidden');
  setLiveInterviewPanelUI(false);
  setSoloRosterUIVisible(false);
  if (!keepPanelSession) {
    activePanelId = null;
    activePanel = null;
    activePanelCandidateId = null;
    activePanelCandidate = null;
  } else {
    activePanelCandidateId = null;
    activePanelCandidate = null;
  }
  if (!silent) switchTab('dashboard');
};

document.getElementById('live-interview-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user || !currentWorkspace) {
    showToast('Workspace connection lost. Please sign in again.', 'error');
    return;
  }

  let candidateName = '';
  if (!isPanelModeActive()) {
    candidateName = document.getElementById('candidate-name').value.trim();
    if (!candidateName) {
      showToast('Please enter the candidate\'s name before saving.', 'error');
      document.getElementById('candidate-name').focus();
      return;
    }
  }

  const unratedCriteria = activeInterviewTemplate.criteria.filter(c => !candidateScores[c.id]);
  if (unratedCriteria.length > 0) {
    showToast(`Please rate all criteria (${unratedCriteria.length} remaining).`, 'error');
    return;
  }

  const submitBtn = event.target.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  if (isPanelModeActive()) {
    try {
      const ok = await submitPanelScorecard();
      if (ok) {
        showToast('Scorecard submitted. Add or select other candidates in the panel dashboard.', 'success');
        cleanupActiveInterview(false, true);
        if (activePanelId) openPanelHub(activePanelId);
      }
    } catch (err) {
      console.error(err);
      showToast('Could not submit scorecard.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
    return;
  }

  const calculatedScore = evaluateOverallPerformanceScore(candidateScores, activeInterviewTemplate.criteria, likertResponses);
  const candidateData = {
    name: candidateName,
    role: document.getElementById('candidate-role').value || activeInterviewTemplate.role || 'General Profile',
    interviewer: document.getElementById('interviewer-name').value.trim() || '—',
    date: document.getElementById('date-of-interview').value,
    templateTitle: activeInterviewTemplate.title,
    templateCriteria: activeInterviewTemplate.criteria?.map((c) => ({ ...c })) || [],
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
    const candidatesCollection = collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates');
    await addDoc(candidatesCollection, candidateData);
    await clearInterviewDraft();
    markSoloRosterCandidateDone(candidateName);

    const nextPending = soloRosterQueue.find((c) => c.status === 'pending');
    if (nextPending && window.confirm(`${candidateData.name} saved — ${calculatedScore}%. Continue with ${nextPending.name}?`)) {
      showToast(`${candidateData.name} saved — score ${calculatedScore}%`, 'success');
      selectSoloRosterCandidate(soloRosterQueue.indexOf(nextPending), { force: true });
      switchTab('live-interview');
      return;
    }

    showToast(`${candidateData.name} saved — score ${calculatedScore}%`);
    cleanupActiveInterview();
    switchTab('class-analytics');
  } catch (err) {
    console.error(err);
    showToast('Could not save evaluation. Please try again.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

const handleDeleteCandidate = async (id) => {
  if (!window.confirm('Delete this evaluation permanently?')) return;
  try {
    await deleteDoc(doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates', id));
    showToast('Evaluation report deleted.');
  } catch (err) {
    showToast('Could not delete report.', 'error');
  }
};

cutoffHighSlider.addEventListener('input', (event) => {
  scoreThresholds.high = Number(event.target.value);
  labelCutoffHigh.textContent = `${scoreThresholds.high}%`;
  renderAnalytics();
  scheduleSaveWorkspaceSettings();
});

cutoffLowSlider.addEventListener('input', (event) => {
  scoreThresholds.low = Number(event.target.value);
  labelCutoffLow.textContent = `${scoreThresholds.low}%`;
  renderAnalytics();
  scheduleSaveWorkspaceSettings();
});

analyticsSearch.addEventListener('input', (event) => {
  filterQuery = event.target.value;
  scheduleRenderAnalytics();
});

analyticsRoleFilter.addEventListener('change', (event) => {
  filterRole = event.target.value;
  renderAnalytics();
});

btnToggleDashboard?.addEventListener('click', () => toggleAnalyticsDashboard(!dashboardVisible));
btnCloseDashboard?.addEventListener('click', () => toggleAnalyticsDashboard(false));
btnExportCsv?.addEventListener('click', exportCandidatesCSV);
btnExportExcel?.addEventListener('click', exportCandidatesExcel);

btnCloseCandidateModal?.addEventListener('click', closeCandidateDetail);
candidateDetailBackdrop?.addEventListener('click', closeCandidateDetail);
btnCandidatePrint?.addEventListener('click', () => viewingCandidate && printCandidateScorecard(viewingCandidate));
btnCandidatePdf?.addEventListener('click', () => viewingCandidate && downloadCandidatePdf(viewingCandidate));
btnCandidateEditToggle?.addEventListener('click', () => {
  candidateDetailEditMode = !candidateDetailEditMode;
  renderCandidateDetailContent();
});
btnCandidateSave?.addEventListener('click', saveCandidateDetailEdits);
btnResumeDraft?.addEventListener('click', resumeInterviewDraft);
btnDiscardDraft?.addEventListener('click', discardInterviewDraft);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && candidateDetailModal && !candidateDetailModal.classList.contains('hidden')) {
    closeCandidateDetail();
  }
});

window.addEventListener('beforeunload', () => {
  if (!activeInterviewTemplate) return;
  const draft = collectLiveInterviewState();
  if (!draft) return;
  const storageKey = getDraftStorageKey();
  if (storageKey) {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); } catch (_) { /* ignore */ }
  }
});

const createStandardTemplate = async () => {
  if (!user || !currentWorkspace) {
    showToast('Sign in to a workspace first.', 'error');
    return;
  }
  if (templates.length > 0) return;

  try {
    const templateCollectionRef = collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'templates');
    await addDoc(templateCollectionRef, {
      title: 'Standard Interview Evaluation',
      description: 'Six core criteria with NS/S/VS ratings and Likert checklist questions.',
      role: '',
      criteria: MANDATORY_CRITERIA_DEFAULTS.map(c => ({ ...c })),
      updatedAt: new Date().toISOString(),
      creator: user.uid
    });
    showToast('Standard rubric created. Launch an assessment when ready.');
  } catch (err) {
    console.error(err);
    showToast('Could not create template. Please try again.', 'error');
  }
};

const initAuth = async () => {
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    } else {
      await signInAnonymously(auth);
    }
  } catch (err) {
    console.error('Auth initialization failure: ', err);
    showToast('Running in offline mode — data won\'t sync until connected.', 'info');
    user = { uid: 'anonymous-local-dev-user' };
    authStatusLabel.textContent = 'Offline';
    setLoginAuthReady(true);
  }
};

initAuth();

onAuthStateChanged(auth, (u) => {
  if (u) {
    user = u;
    authStatusLabel.textContent = 'Connected';
    setLoginAuthReady(true);
    if (currentWorkspace) setupFirestoreSync();
  } else {
    user = null;
    authStatusLabel.textContent = 'Disconnected';
    setLoginAuthReady(false);
  }
});

let unsubscribeTemplates = null;
let unsubscribeCandidates = null;
let legacyCleanupDone = false;

const LEGACY_SAMPLE_CANDIDATE_NAMES = new Set(['Rohan Varma', 'Simran Kaur', 'Daniel Craig']);

const removeLegacySampleCandidates = async () => {
  if (!currentWorkspace || !user || legacyCleanupDone) return;
  const legacy = candidates.filter((c) => LEGACY_SAMPLE_CANDIDATE_NAMES.has(c.name));
  if (legacy.length === 0) {
    legacyCleanupDone = true;
    return;
  }
  try {
    await Promise.all(
      legacy.map((c) =>
        deleteDoc(doc(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates', c.id))
      )
    );
    showToast(`Removed ${legacy.length} old sample evaluation${legacy.length > 1 ? 's' : ''} from this workspace.`, 'info');
  } catch (err) {
    console.error('Legacy cleanup failed:', err);
  }
  legacyCleanupDone = true;
};

const setupFirestoreSync = () => {
  if (!currentWorkspace) return;

  const templatesCollection = collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'templates');
  const candidatesCollection = collection(db, 'artifacts', app_id, 'workspaces', currentWorkspace, 'candidates');

  if (unsubscribeTemplates) unsubscribeTemplates();
  if (unsubscribeCandidates) unsubscribeCandidates();

  unsubscribeTemplates = onSnapshot(templatesCollection, (snapshot) => {
    templates = [];
    snapshot.forEach((docSnap) => templates.push({ id: docSnap.id, ...docSnap.data() }));
    if (tabDashboardContent && !tabDashboardContent.classList.contains('hidden')) {
      renderTemplates();
    }
  }, (error) => {
    console.error('Templates snapshot fetch error:', error);
    showToast('Could not load templates. Check your connection.', 'error');
  });

  unsubscribeCandidates = onSnapshot(candidatesCollection, async (snapshot) => {
    candidates = [];
    snapshot.forEach((docSnap) => candidates.push({ id: docSnap.id, ...docSnap.data() }));
    await removeLegacySampleCandidates();
    if (tabClassAnalyticsContent && !tabClassAnalyticsContent.classList.contains('hidden')) {
      renderAnalytics();
    }
  }, (error) => {
    console.error('Candidates snapshot fetch error:', error);
  });
};

if (btnShareWs) {
  btnShareWs.addEventListener('click', () => {
    if (!currentWorkspace) return;
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', currentWorkspace);
    if (navigator.share) {
      navigator.share({
        title: 'Join my Workspace on TalentCalibrate',
        text: 'Join my workspace to calibrate interviews together.',
        url: url.href
      }).catch(console.error);
    } else {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url.href).then(() => {
          showToast('Workspace link copied to clipboard!');
        });
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = url.href;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast('Workspace link copied to clipboard!');
      }
    }
  });
}

// 1. Service Worker Update Notification
window.addEventListener('sw-update-available', (e) => {
  const reg = e.detail;
  showToast('A new update is available. Click here to reload and update.', 'info', true);
  if (toastWrapper) {
    toastWrapper.style.cursor = 'pointer';
    const handleUpdate = () => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage('skipWaiting');
      }
      window.location.reload();
    };
    toastWrapper.addEventListener('click', handleUpdate, { once: true });
  }
});

// 2. Custom A2HS (Add to Home Screen) Install Prompt
let deferredPrompt;
const btnInstallPwas = document.querySelectorAll('.btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstallPwas.forEach(btn => {
    btn.classList.remove('hidden');
    if (btn.id === 'btn-install-pwa') {
      btn.classList.add('inline-flex');
    } else {
      btn.classList.add('flex');
    }
  });
});

btnInstallPwas.forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install prompt response: ${outcome}`);
    deferredPrompt = null;
    btnInstallPwas.forEach(b => {
      b.classList.add('hidden');
      b.classList.remove('inline-flex', 'flex');
    });
  });
});

window.addEventListener('appinstalled', (evt) => {
  console.log('TalentCalibrate PWA was installed successfully!');
  btnInstallPwas.forEach(b => {
    b.classList.add('hidden');
    b.classList.remove('inline-flex', 'flex');
  });
});

// 3. Online/Offline Toast Notifications
const offlineToast = document.getElementById('offline-toast');

const showOfflineToast = () => {
  if (offlineToast) {
    offlineToast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    offlineToast.classList.add('translate-y-0', 'opacity-100');
  }
};

const hideOfflineToast = () => {
  if (offlineToast) {
    offlineToast.classList.remove('translate-y-0', 'opacity-100');
    offlineToast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
  }
};

window.addEventListener('offline', showOfflineToast);
window.addEventListener('online', () => {
  hideOfflineToast();
  showToast('You are back online! Syncing records...');
});

// Check status on startup
if (!navigator.onLine) {
  showOfflineToast();
}

// ==========================================
// CHATBOT ASSISTANT LOGIC
// ==========================================

const chatbotFab = document.getElementById('chatbot-fab');
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotClose = document.getElementById('chatbot-close');
const chatbotClear = document.getElementById('chatbot-clear');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotForm = document.getElementById('chatbot-form');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotChips = document.getElementById('chatbot-chips');

const CHATBOT_SUGGESTED_TOPICS = [
  'How is score calculated?',
  'Explain Panel Mode',
  'Show workspace stats',
  'How do I export results?',
  'What can you ask?'
];

const CHATBOT_WELCOME_MESSAGE = `Hi! I am your TalentCalibrate assistant. Ask me about grading, panel mode, candidate stats, or how to use the evaluation tools!`;

let chatbotIsProcessing = false;

function sanitizeBotReply(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}

function updateChatbotSuggestions() {
  if (!chatbotChips) return;
  chatbotChips.innerHTML = '';
  CHATBOT_SUGGESTED_TOPICS.slice(0, 5).forEach((topic) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chatbot-chip rounded-full border border-indigo-100 bg-indigo-50/50 px-2.5 py-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 transition cursor-pointer';
    chip.textContent = topic;
    chatbotChips.appendChild(chip);
  });
}

function resetChatbotMessages() {
  if (!chatbotMessages) return;
  chatbotMessages.innerHTML = '';
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'flex items-start gap-2 max-w-[85%] self-start';
  welcomeDiv.innerHTML = `
    <div class="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs shrink-0">🤖</div>
    <div class="rounded-2xl rounded-tl-none bg-slate-100 p-2.5 text-xs text-slate-800 leading-relaxed">${sanitizeBotReply(CHATBOT_WELCOME_MESSAGE)}</div>
  `;
  chatbotMessages.appendChild(welcomeDiv);
  scrollToBottom();
}

if (chatbotFab && chatbotPanel && chatbotClose) {
  // Toggle chatbot panel
  chatbotFab.addEventListener('click', () => {
    chatbotPanel.classList.toggle('is-active');
    chatbotPanel.classList.toggle('hidden');
    scrollToBottom();
  });

  chatbotClose.addEventListener('click', () => {
    chatbotPanel.classList.remove('is-active');
    chatbotPanel.classList.add('hidden');
  });

  chatbotClear?.addEventListener('click', () => {
    resetChatbotMessages();
  });

  // Handle suggested action chips
  chatbotChips?.addEventListener('click', (e) => {
    const button = e.target.closest('.chatbot-chip');
    if (button) {
      const queryText = button.textContent.trim();
      handleUserQuery(queryText);
    }
  });

  // Handle form submission
  chatbotForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chatbotIsProcessing) return;
    const queryText = chatbotInput.value.trim();
    if (!queryText) return;
    chatbotInput.value = '';
    handleUserQuery(queryText);
  });

  updateChatbotSuggestions();
  resetChatbotMessages();
}

function scrollToBottom() {
  if (chatbotMessages) {
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }
}

function handleUserQuery(queryText) {
  if (chatbotIsProcessing) return;
  chatbotIsProcessing = true;

  // Append user message
  appendChatMessage(queryText, 'user');
  scrollToBottom();

  // Show typing indicator
  const typingIndicator = showTypingIndicator();
  scrollToBottom();

  const dynamicDelay = Math.min(1200, 450 + queryText.length * 18);

  setTimeout(() => {
    removeTypingIndicator(typingIndicator);
    const replyText = generateBotResponse(queryText);
    appendChatMessage(replyText, 'bot', true, () => {
      chatbotIsProcessing = false;
      scrollToBottom();
    });
  }, dynamicDelay);
}

function appendChatMessage(text, sender, animate = false, finishedCallback) {
  if (!chatbotMessages) return;

  const msgDiv = document.createElement('div');
  if (sender === 'user') {
    msgDiv.className = 'max-w-[85%] self-end rounded-2xl rounded-tr-none bg-indigo-600 p-2.5 text-xs text-white leading-relaxed';
    msgDiv.textContent = text;
  } else {
    msgDiv.className = 'flex items-start gap-2 max-w-[85%] self-start';
    msgDiv.innerHTML = `
      <div class="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs shrink-0">🤖</div>
    `;

    const bubble = document.createElement('div');
    bubble.className = 'rounded-2xl rounded-tl-none bg-slate-100 p-2.5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words';
    if (animate) {
      typewriterReveal(bubble, text, finishedCallback);
    } else {
      bubble.textContent = text;
      if (finishedCallback) finishedCallback();
    }
    msgDiv.appendChild(bubble);
  }

  chatbotMessages.appendChild(msgDiv);
}

function typewriterReveal(element, text, finishedCallback) {
  const normalizedText = String(text).replace(/<br\/?/gi, '\n');
  let index = 0;
  const speed = Math.max(12, Math.min(30, 750 / Math.max(1, normalizedText.length)));

  function step() {
    element.textContent = normalizedText.slice(0, index);
    index += 1;
    if (index <= normalizedText.length) {
      setTimeout(step, speed);
    } else if (finishedCallback) {
      finishedCallback();
    }
  }

  step();
}

function showTypingIndicator() {
  if (!chatbotMessages) return null;
  const indicatorDiv = document.createElement('div');
  indicatorDiv.className = 'flex items-start gap-2 max-w-[85%] self-start';
  indicatorDiv.innerHTML = `
    <div class="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs shrink-0">🤖</div>
    <div class="rounded-2xl rounded-tl-none bg-slate-100 p-2 text-xs text-slate-800 flex items-center">
      <div class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  chatbotMessages.appendChild(indicatorDiv);
  return indicatorDiv;
}

function removeTypingIndicator(indicatorDiv) {
  if (indicatorDiv && indicatorDiv.parentNode) {
    indicatorDiv.parentNode.removeChild(indicatorDiv);
  }
}

function generateBotResponse(query) {
  const cleanQuery = query.toLowerCase();

  // 0. General help and introduction
  if (cleanQuery.includes('help') || cleanQuery.includes('what can') || cleanQuery.includes('how do i') || cleanQuery.includes('usage')) {
    return `I can help you with TalentCalibrate features, scoring, panel mode, exports, and workspace analytics.

• Ask about score calculation, exports, or panel workflow.
• Ask "Show workspace stats" to see current candidate totals.
• Ask "Explain Panel Mode" if you want team evaluation guidance.`;
  }

  // 1. Scoring & Formula queries
  if (cleanQuery.includes('score') || cleanQuery.includes('calculate') || cleanQuery.includes('formula') || cleanQuery.includes('grade') || cleanQuery.includes('rating')) {
    return `TalentCalibrate calculates overall percentage scores by combining weighted criteria ratings with checklist modifiers:

• Criteria assessment: Each criterion is rated from Not Satisfactory to Very Satisfactory.
• Weighting: Criteria weights are combined to form a normalized total score.
• Modifiers: Checklist questions and evaluator comments adjust calibration and final recommendations.`;
  }

  // 2. Panel Mode queries
  if (cleanQuery.includes('panel') || cleanQuery.includes('together') || cleanQuery.includes('multi')) {
    return `Panel Mode lets multiple interviewers evaluate candidates collectively:

1. Create a panel session in the dashboard.
2. Share the generated session code with your team.
3. Team members join using the code, and their individual scorecards are automatically averaged on the Calibration dashboard to ensure consistency.`;
  }

  // 3. Stats / Data queries (reads runtime values)
  if (cleanQuery.includes('stats') || cleanQuery.includes('candidates') || cleanQuery.includes('count') || cleanQuery.includes('workspace')) {
    const wsName = currentWorkspace || 'None';
    const totalCount = candidates.length;
    const topT = candidates.filter((c) => c.calculatedScore >= scoreThresholds.high).length;
    const midT = candidates.filter((c) => c.calculatedScore >= scoreThresholds.low && c.calculatedScore < scoreThresholds.high).length;
    const lowT = candidates.filter((c) => c.calculatedScore < scoreThresholds.low).length;

    return `Here are the real-time statistics for the active workspace (${wsName}):

• Total Candidates Evaluated: ${totalCount}
• Top Performers (≥${scoreThresholds.high}%): ${topT}
• Mid Performers: ${midT}
• Low Performers (<${scoreThresholds.low}%): ${lowT}`;
  }

  // 4. Template queries
  if (cleanQuery.includes('template') || cleanQuery.includes('rubric') || cleanQuery.includes('criteria')) {
    return `You currently have <strong>${templates.length}</strong> active evaluation blueprints. 
    <br/><br/>
    Standard rubrics assess 6 core criteria: Technical depth, System design, Execution, Communication, Leadership, and Cultural alignment. You can customize them in the 'Customize Rubrics Form' tab.`;
  }

  // 5. Export / download queries
  if (cleanQuery.includes('export') || cleanQuery.includes('csv') || cleanQuery.includes('excel') || cleanQuery.includes('download') || cleanQuery.includes('pdf')) {
    return `You can export data in several ways:

• Excel/CSV: Go to the Calibration & Analytics tab and click the Download CSV or Download Excel buttons.
• PDF Scorecard: In the dashboard table, click the PDF icon next to any candidate to download a styled summary report.`;
  }

  // 6. Offline / connection queries
  if (cleanQuery.includes('offline') || cleanQuery.includes('sync') || cleanQuery.includes('network') || cleanQuery.includes('connection')) {
    const status = navigator.onLine ? 'Online' : 'Offline';
    return `TalentCalibrate is fully offline-resilient! Your current status is: ${status}.

If offline, all evaluation drafts and completed scorecards are saved locally using IndexedDB persistence. They will sync automatically to the cloud when you connect.`;
  }

  // Fallback
  return `I'm here to help you navigate TalentCalibrate! Try asking about:

• "How are scores computed?"
• "Explain Panel Mode"
• "Show workspace stats"
• "How do I export results?"`;
}


