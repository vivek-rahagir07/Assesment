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

let chartInstances = {};
let dashboardVisible = false;

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

const initLoginUX = () => {
  if (loginTagline) {
    loginTagline.style.borderRight = '2px solid rgba(199, 210, 254, 0.8)';
    loginTagline.style.paddingRight = '4px';
    
    setInterval(() => {
      loginTagline.style.borderColor = loginTagline.style.borderColor === 'transparent' ? 'rgba(199, 210, 254, 0.8)' : 'transparent';
    }, 500);

    const playTaglineSequence = async () => {
      while (true) {
        await typeWriterEffect(loginTagline, LOGIN_TAGLINES[taglineIndex]);
        await new Promise(r => setTimeout(r, 4000));
        
        let currentText = loginTagline.textContent;
        while (currentText.length > 0) {
          currentText = currentText.slice(0, -1);
          loginTagline.textContent = currentText;
          await new Promise(r => setTimeout(r, 20));
        }
        
        taglineIndex = (taglineIndex + 1) % LOGIN_TAGLINES.length;
        await new Promise(r => setTimeout(r, 500));
      }
    };
    
    setTimeout(playTaglineSequence, 800);
  }

  wsNameInput?.addEventListener('input', () => {
    const wrap = wsNameInput.closest('.field-input-wrap');
    wrap?.classList.toggle('is-valid', wsNameInput.value.trim().length >= 2);
    wsErrorMsg.classList.add('hidden');
  });

  wsPassInput?.addEventListener('input', () => wsErrorMsg.classList.add('hidden'));

  const urlParams = new URLSearchParams(window.location.search);
  const wsParam = urlParams.get('workspace');
  if (wsParam && wsNameInput) {
    wsNameInput.value = wsParam;
    const wrap = wsNameInput.closest('.field-input-wrap');
    wrap?.classList.add('is-valid');
    setTimeout(() => wsPassInput?.focus(), 600);
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

  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(wsName)) {
    showLoginError('Workspace name: 2–64 characters, letters, numbers, _ and - only.');
    return;
  }

  setSubmitLoading(true);

  try {
    const wsRef = doc(db, 'artifacts', app_id, 'workspaces', wsName);
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
    showLoginError(`Error: ${err.message}`);
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
  Object.keys(chartInstances).forEach(destroyChart);
  legacyCleanupDone = false;
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
  if (btnShareWs) {
    btnShareWs.classList.add('hidden');
    btnShareWs.classList.remove('flex');
  }
  loginSuccessOverlay?.classList.add('hidden');
  setLoginAuthReady(!!user);
  setSubmitLoading(false);
  wsNameInput?.focus();

  if (unsubscribeTemplates) unsubscribeTemplates();
  if (unsubscribeCandidates) unsubscribeCandidates();

  templates = [];
  candidates = [];
  legacyCleanupDone = false;
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

  const criteriaFinalScore = totalWeightUsed > 0 ? (totalWeightedScore / totalWeightUsed) * 100 : 0;
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

  if (likertsAnswered === 0) return Math.round(criteriaFinalScore * 10) / 10;

  const likertFinalScore = (totalLikertScore / (likertsAnswered * 10)) * 100;
  const finalScore = (criteriaFinalScore * 0.6) + (likertFinalScore * 0.4);
  return Math.round(finalScore * 10) / 10;
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

const exportCandidatesExcel = () => {
  const list = getFilteredCandidates();
  if (list.length === 0) {
    showToast('No candidate records to export.', 'error');
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

const renderAnalyticsDashboard = () => {
  if (!analyticsDashboardPanel || typeof Chart === 'undefined') return;

  const list = getFilteredCandidates().slice().sort((a, b) => (b.calculatedScore || 0) - (a.calculatedScore || 0));
  renderDashboardStats(list);

  ['chart-scores-bar', 'chart-tier-doughnut', 'chart-role-avg', 'chart-role-count'].forEach(destroyChart);

  if (list.length === 0) return;

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
  switchTab('live-interview');
};

const updateLiveTimerDisplay = (seconds) => {
  const formatted = getFormattedTime(seconds);
  document.querySelectorAll('.live-duration-text').forEach((el) => { el.textContent = formatted; });
};

document.getElementById('candidate-name').addEventListener('input', (event) => {
  navActiveCandidateName.textContent = event.target.value.trim() || 'New interview';
});

document.getElementById('btn-cancel-interview').addEventListener('click', () => {
  if (window.confirm('Discard this interview? Unsaved ratings will be lost.')) cleanupActiveInterview();
});

const cleanupActiveInterview = (silent = false) => {
  clearInterval(timerInterval);
  timerInterval = null;
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

btnToggleDashboard?.addEventListener('click', () => toggleAnalyticsDashboard(!dashboardVisible));
btnCloseDashboard?.addEventListener('click', () => toggleAnalyticsDashboard(false));
btnExportCsv?.addEventListener('click', exportCandidatesCSV);
btnExportExcel?.addEventListener('click', exportCandidatesExcel);

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
