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

const mainAppContainer = document.getElementById('main-app-container');
const loginShell = document.getElementById('login-shell');
const workspacePanelEntry = document.getElementById('workspace-panel');

// Workspace options
const workspaceOptions = document.getElementById('workspace-options');

// Existing workspace form
const workspaceEntryExisting = document.getElementById('workspace-entry-existing');
const workspaceFormExisting = document.getElementById('workspace-form-existing');
const wsNameExistingInput = document.getElementById('ws-name-existing');
const wsPassExistingInput = document.getElementById('ws-pass-existing');
const wsErrorMsgExisting = document.getElementById('ws-error-msg-existing');
const btnTogglePassExisting = document.getElementById('btn-toggle-pass-existing');
const btnWsSubmitExisting = document.getElementById('btn-ws-submit-existing');
const loginAuthPill = document.getElementById('login-auth-pill');
const loginAuthLabel = document.getElementById('login-auth-label');

// Create new workspace form
const workspaceEntryNew = document.getElementById('workspace-entry-new');
const workspaceFormNew = document.getElementById('workspace-form-new');
const wsNameNewInput = document.getElementById('ws-name-new');
const wsPassNewInput = document.getElementById('ws-pass-new');
const wsErrorMsgNew = document.getElementById('ws-error-msg-new');
const btnTogglePassNew = document.getElementById('btn-toggle-pass-new');
const btnWsSubmitNew = document.getElementById('btn-ws-submit-new');

const loginSuccessOverlay = document.getElementById('login-success-overlay');
const loginSuccessMsg = document.getElementById('login-success-msg');
const headerWsBadge = document.getElementById('header-ws-badge');
const btnSwitchWs = document.getElementById('btn-switch-ws');
const btnShowWorkspace = document.getElementById('btn-show-workspace');
const btnShareWs = document.getElementById('btn-share-ws');
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
  html2pdf: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
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

const LOGIN_TAGLINES = [
  'Where great hiring decisions start — together.',
  'Fair scores. Clear feedback. Better hires.',
  'Your team\'s calibration hub, ready when you are.',
  'Less guesswork, more confidence in every interview.'
];

let taglineIndex = 0;

const typeWriterEffect = async (element, text, speed = 40) => {
  element.textContent = '';
  for (let i = 0; i < text.length; i++) {
    element.textContent += text.charAt(i);
    await new Promise(r => setTimeout(r, speed));
  }
};

const showWorkspaceOptions = () => {
  workspaceOptions.classList.remove('hidden');
  workspaceEntryExisting.classList.add('hidden');
  workspaceEntryNew.classList.add('hidden');
};

const showExistingWorkspaceForm = () => {
  workspaceOptions.classList.add('hidden');
  workspaceEntryExisting.classList.remove('hidden');
  workspaceEntryNew.classList.add('hidden');
  wsNameExistingInput?.focus();
};

const showCreateWorkspaceForm = () => {
  workspaceOptions.classList.add('hidden');
  workspaceEntryExisting.classList.add('hidden');
  workspaceEntryNew.classList.remove('hidden');
  wsNameNewInput?.focus();
};

const initLoginUX = () => {
  // Re-query buttons to ensure DOM is ready
  const btnExistingWorkspace = document.getElementById('btn-existing-workspace');
  const btnCreateWorkspace = document.getElementById('btn-create-workspace');
  const btnBackToOptionsExisting = document.getElementById('btn-back-to-options');
  const btnBackToOptionsNew = document.getElementById('btn-back-to-options-new');
  
  // Option buttons
  if (btnExistingWorkspace) btnExistingWorkspace.addEventListener('click', showExistingWorkspaceForm);
  if (btnCreateWorkspace) btnCreateWorkspace.addEventListener('click', showCreateWorkspaceForm);
  if (btnBackToOptionsExisting) btnBackToOptionsExisting.addEventListener('click', showWorkspaceOptions);
  if (btnBackToOptionsNew) btnBackToOptionsNew.addEventListener('click', showWorkspaceOptions);

  // Initialize input validation for existing form
  wsNameExistingInput?.addEventListener('input', () => {
    const wrap = wsNameExistingInput.closest('.field-input-wrap');
    wrap?.classList.toggle('is-valid', wsNameExistingInput.value.trim().length >= 2);
    wsErrorMsgExisting.classList.add('hidden');
  });
  wsPassExistingInput?.addEventListener('input', () => wsErrorMsgExisting.classList.add('hidden'));

  // Initialize input validation for new form
  wsNameNewInput?.addEventListener('input', () => {
    const wrap = wsNameNewInput.closest('.field-input-wrap');
    wrap?.classList.toggle('is-valid', wsNameNewInput.value.trim().length >= 2);
    wsErrorMsgNew.classList.add('hidden');
  });
  wsPassNewInput?.addEventListener('input', () => wsErrorMsgNew.classList.add('hidden'));

  const urlParams = new URLSearchParams(window.location.search);
  const wsParam = urlParams.get('workspace');
  if (wsParam && wsNameExistingInput) {
    wsNameExistingInput.value = wsParam;
    const wrap = wsNameExistingInput.closest('.field-input-wrap');
    wrap?.classList.add('is-valid');
    setTimeout(() => wsPassExistingInput?.focus(), 600);
  }
};

const setLoginAuthReady = (ready = true) => {
  if (!loginAuthPill || !loginAuthLabel) return;
  loginAuthPill.classList.toggle('login-auth-pill--pending', !ready);
  loginAuthPill.classList.toggle('login-auth-pill--ready', ready);
  loginAuthLabel.textContent = ready ? 'All set — you can sign in now' : 'Connecting you securely…';
};

const showLoginErrorExisting = (message) => {
  wsErrorMsgExisting.textContent = message;
  wsErrorMsgExisting.classList.remove('hidden');
  wsErrorMsgExisting.style.animation = 'none';
  void wsErrorMsgExisting.offsetWidth;
  wsErrorMsgExisting.style.animation = '';
  workspaceFormExisting?.classList.add('shake-form');
  setTimeout(() => workspaceFormExisting?.classList.remove('shake-form'), 500);
};

const showLoginErrorNew = (message) => {
  wsErrorMsgNew.textContent = message;
  wsErrorMsgNew.classList.remove('hidden');
  wsErrorMsgNew.style.animation = 'none';
  void wsErrorMsgNew.offsetWidth;
  wsErrorMsgNew.style.animation = '';
  workspaceFormNew?.classList.add('shake-form');
  setTimeout(() => workspaceFormNew?.classList.remove('shake-form'), 500);
};

const setSubmitLoadingExisting = (loading) => {
  if (!btnWsSubmitExisting) return;
  btnWsSubmitExisting.disabled = loading;
  btnWsSubmitExisting.classList.toggle('is-loading', loading);
  btnWsSubmitExisting.querySelector('.login-submit-loader')?.classList.toggle('hidden', !loading);
};

const setSubmitLoadingNew = (loading) => {
  if (!btnWsSubmitNew) return;
  btnWsSubmitNew.disabled = loading;
  btnWsSubmitNew.classList.toggle('is-loading', loading);
  btnWsSubmitNew.querySelector('.login-submit-loader')?.classList.toggle('hidden', !loading);
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
    setSubmitLoadingExisting(false);
    mainAppContainer?.classList.add('app-reveal');
    setTimeout(() => mainAppContainer?.classList.remove('app-reveal'), 700);
  }, 1200);
};

initLoginUX();

// Existing Workspace Form Handler
workspaceFormExisting.addEventListener('submit', async (event) => {
  event.preventDefault();
  wsErrorMsgExisting.classList.add('hidden');

  if (!user) {
    showLoginErrorExisting('Hang tight — we\'re still connecting. Try again in a second.');
    return;
  }

  const wsName = wsNameExistingInput.value.trim();
  const wsPass = wsPassExistingInput.value;

  if (!wsName || !wsPass) {
    showLoginErrorExisting('We need both a workspace name and password to sign in.');
    return;
  }

  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(wsName)) {
    showLoginErrorExisting('Workspace name: 2–64 characters, letters, numbers, _ and - only.');
    return;
  }

  setSubmitLoadingExisting(true);

  try {
    const wsRef = doc(db, 'artifacts', app_id, 'workspaces', wsName);
    const wsSnap = await getDoc(wsRef);
    if (wsSnap.exists()) {
      if (wsSnap.data().password === wsPass) {
        playSuccessAndEnter(wsName, false);
        return;
      }
      showLoginErrorExisting('That password doesn\'t match this workspace. Double-check and try again.');
    } else {
      showLoginErrorExisting('This workspace does not exist. Please create a new one instead.');
    }
  } catch (err) {
    console.error(err);
    showLoginErrorExisting(`Error: ${err.message}`);
  }
  setSubmitLoadingExisting(false);
});

// Create New Workspace Form Handler
workspaceFormNew.addEventListener('submit', async (event) => {
  event.preventDefault();
  wsErrorMsgNew.classList.add('hidden');

  if (!user) {
    showLoginErrorNew('Hang tight — we\'re still connecting. Try again in a second.');
    return;
  }

  const wsName = wsNameNewInput.value.trim();
  const wsPass = wsPassNewInput.value;

  if (!wsName || !wsPass) {
    showLoginErrorNew('We need both a workspace name and password to create a new workspace.');
    return;
  }

  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(wsName)) {
    showLoginErrorNew('Workspace name: 2–64 characters, letters, numbers, _ and - only.');
    return;
  }

  setSubmitLoadingNew(true);

  try {
    const wsRef = doc(db, 'artifacts', app_id, 'workspaces', wsName);
    const wsSnap = await getDoc(wsRef);
    if (wsSnap.exists()) {
      showLoginErrorNew('This workspace name is already taken. Please choose a different one.');
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
    showLoginErrorNew(`Error: ${err.message}`);
  }
  setSubmitLoadingNew(false);
});

const enterWorkspace = (wsName) => {
  currentWorkspace = wsName;
  
  // Hide login card grid and show main app
  const loginCardGrid = document.querySelector('.login-card-grid');
  if (loginCardGrid) {
    loginCardGrid.classList.add('hidden');
  }
  
  workspacePanelEntry.classList.add('hidden');
  mainAppContainer.classList.remove('hidden');
  mainAppContainer.classList.add('visible');
  loginShell?.classList.add('is-authenticated');
  headerWsBadge.textContent = wsName;
  headerWsBadge.classList.remove('hidden');
  if (btnShareWs) {
    btnShareWs.classList.remove('hidden');
    btnShareWs.classList.add('flex');
  }
  wsNameExistingInput.value = '';
  wsPassExistingInput.value = '';
  wsNameNewInput.value = '';
  wsPassNewInput.value = '';
  wsErrorMsgExisting.classList.add('hidden');
  wsErrorMsgNew.classList.add('hidden');
  filterRole = 'All';
  filterQuery = '';
  if (analyticsSearch) analyticsSearch.value = '';
  dashboardVisible = false;
  analyticsDashboardPanel?.classList.add('hidden');
  Object.keys(chartInstances).forEach(destroyChart);
  legacyCleanupDone = false;
  loadWorkspaceSettings();
  loadInterviewDraft().then(() => renderDraftBanner());
  setupFirestoreSync();
  switchTab('dashboard');
};

btnSwitchWs.addEventListener('click', () => {
  if (activeInterviewTemplate && !window.confirm('Leave workspace? Your active interview will be discarded.')) return;

  cleanupActiveInterview(true);
  currentWorkspace = null;
  
  // Show login card grid again
  const loginCardGrid = document.querySelector('.login-card-grid');
  if (loginCardGrid) {
    loginCardGrid.classList.remove('hidden');
  }
  
  workspacePanelEntry.classList.remove('hidden');
  mainAppContainer.classList.add('hidden');
  loginShell?.classList.remove('is-authenticated');
  if (btnShareWs) {
    btnShareWs.classList.add('hidden');
    btnShareWs.classList.remove('flex');
  }
  loginSuccessOverlay?.classList.add('hidden');
  setLoginAuthReady(!!user);
  setSubmitLoadingExisting(false);
  setSubmitLoadingNew(false);
  
  // Show workspace options instead of form
  showWorkspaceOptions();

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

if (btnTogglePassExisting && wsPassExistingInput) {
  btnTogglePassExisting.addEventListener('click', () => {
    const isPassword = wsPassExistingInput.type === 'password';
    wsPassExistingInput.type = isPassword ? 'text' : 'password';
    btnTogglePassExisting.querySelector('.icon-show')?.classList.toggle('hidden', isPassword);
    btnTogglePassExisting.querySelector('.icon-hide')?.classList.toggle('hidden', !isPassword);
    btnTogglePassExisting.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
}

if (btnTogglePassNew && wsPassNewInput) {
  btnTogglePassNew.addEventListener('click', () => {
    const isPassword = wsPassNewInput.type === 'password';
    wsPassNewInput.type = isPassword ? 'text' : 'password';
    btnTogglePassNew.querySelector('.icon-show')?.classList.toggle('hidden', isPassword);
    btnTogglePassNew.querySelector('.icon-hide')?.classList.toggle('hidden', !isPassword);
    btnTogglePassNew.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
}

if (btnShowWorkspace) {
  btnShowWorkspace.addEventListener('click', showExistingWorkspaceForm);
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
  const draft = collectLiveInterviewState();
  if (!draft || !currentWorkspace || !user) return;

  const hasContent = draft.candidateName.trim()
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
  if (liveInterviewAutosaveBound || !tabLiveInterviewContent) return;
  liveInterviewAutosaveBound = true;

  tabLiveInterviewContent.addEventListener('input', scheduleDraftSave);
  tabLiveInterviewContent.addEventListener('change', scheduleDraftSave);
  tabLiveInterviewContent.addEventListener('click', (event) => {
    if (event.target.closest('.btn-score-select, .btn-likert-choice')) scheduleDraftSave();
  });
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
        <button class="btn-launch-interview bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-full transition shadow-sm">Launch Assessment Sheet</button>
      </div>
    `;

    card.querySelector('.btn-edit-tpl').addEventListener('click', () => triggerEditTemplate(tpl));
    card.querySelector('.btn-delete-tpl').addEventListener('click', () => handleDeleteTemplate(tpl.id));
    card.querySelector('.btn-launch-interview').addEventListener('click', () => handleStartInterview(tpl));

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
        <button class="btn-view-cand p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100" title="View full evaluation">👁</button>
        <button class="btn-print-cand p-2 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100" title="Print scorecard">🖨</button>
        <button class="btn-pdf-cand p-2 bg-violet-50 text-violet-600 rounded-full hover:bg-violet-100" title="Download PDF scorecard">📄</button>
        <button class="btn-copy-report p-2 bg-slate-50 text-slate-600 rounded-full hover:bg-slate-100" title="Copy scorecard report to clipboard">📋</button>
        <button class="btn-delete-cand p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100" title="Remove Evaluation permanently">🗑</button>
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

  activeInterviewTemplate = template;
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
  renderLiveInterviewSheet();
  bindLiveInterviewAutosave();
  switchTab('live-interview');
};

const updateLiveTimerDisplay = (seconds) => {
  const formatted = getFormattedTime(seconds);
  document.querySelectorAll('.live-duration-text').forEach((el) => { el.textContent = formatted; });
};

document.getElementById('candidate-name').addEventListener('input', (event) => {
  navActiveCandidateName.textContent = event.target.value.trim() || 'New interview';
});

document.getElementById('btn-cancel-interview').addEventListener('click', async () => {
  if (!window.confirm('Leave this interview? Your progress is auto-saved as a draft you can resume later.')) return;
  await saveInterviewDraft();
  cleanupActiveInterview();
});

const cleanupActiveInterview = (silent = false) => {
  clearInterval(timerInterval);
  timerInterval = null;
  clearTimeout(draftSaveTimer);
  activeInterviewTemplate = null;
  candidateScores = {};
  candidateNotes = {};
  likertResponses = {};
  interviewDuration = 0;
  navActiveAssessmentContainer.classList.add('hidden');
  if (!silent) switchTab('dashboard');
};

document.getElementById('live-interview-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!user || !currentWorkspace) {
    showToast('Workspace connection lost. Please sign in again.', 'error');
    return;
  }

  const candidateName = document.getElementById('candidate-name').value.trim();
  if (!candidateName) {
    showToast('Please enter the candidate\'s name before saving.', 'error');
    document.getElementById('candidate-name').focus();
    return;
  }

  const unratedCriteria = activeInterviewTemplate.criteria.filter(c => !candidateScores[c.id]);
  if (unratedCriteria.length > 0) {
    showToast(`Please rate all criteria (${unratedCriteria.length} remaining).`, 'error');
    return;
  }

  const submitBtn = event.target.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, (error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}
