import { diagnoseTranscriptionEndpoint, parseVoiceTranscript, transcriptionFailureKey } from "./voice.js";
import { localMonthKey, renderExpenseCalendar } from "./calendar-feature/calendar.js";
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  addCurrency,
  subtractCurrency,
  calculatePersonalReimbursements,
  calculateCategoryBreakdown,
  calculateRoomBreakdown,
  calculateBudgetStatus
} from "./accounting.js";
import { queryRows } from "./query-results.js";
import { hasHouseholdOwnerRole } from "./household-permissions.js";
import {
  CURRENT_APP_VERSION,
  GITHUB_RELEASES_API,
  getApkReleaseUpdate
} from "./apk-updater.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastBox = document.querySelector("#toast");

const money = n => formatCurrency(n, locale());
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const localIsoDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = () => localIsoDate(new Date());
const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" }) : "";
const monthStart = (shift = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + shift);
  return localIsoDate(d);
};
const locale = () => state.profile?.language === "ta" ? "ta-IN" : "en-IN";

const T = {
  en: {
    home: "Home", insights: "Insights", ledger: "Transactions", groceries: "Groceries", calendar: "Calendar",
    bills: "Bills", goals: "Goals", reports: "Reports", settings: "Settings",
    household: "Household", more: "More", spent: "Spent this month", recent: "Recent expenses",
    calendarSubtitle: "Daily spending by date",
    addExpense: "Add expense", editExpense: "Edit expense", deleteExpense: "Delete expense",
    expenseDetails: "Expense details", signIn: "Sign in", signUp: "Create account",
    email: "Email", password: "Password", name: "Your name", roomSetup: "Create or join a household",
    createRoom: "Create household", joinRoom: "Join with invite code", roomName: "Household name",
    invite: "Invite code", switchRoom: "Your households", createAnotherRoom: "Create another household",
    joinAnotherRoom: "Join another household", roomsHelp: "Manage households or switch between them at any time.",
    roomCreated: "Household created and selected.", roomJoined: "Joined household and selected.",
    categoryBreakdown: "Spending by category", remainingBudget: "left this month", darkTheme: "Dark mode", lightTheme: "Light mode",
    monthlyBudget: "Monthly budgets",
    explainAlerts: "Each alert includes the recorded transactions and comparisons behind it.",
    noAlerts: "No spending alerts right now. Alerts trigger based on your household's actual transactions and thresholds.",
    noExpenses: "No expenses recorded yet.",
    paidBy: "Paid by", amount: "Amount", category: "Category", description: "Description",
    date: "Date", funding: "Money used", personal: "Personal pocket", shared: "Shared household fund",
    save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", undo: "Undo", receipt: "Scan receipt",
    cameraGallery: "Camera or gallery", groceryAdd: "Add item", quantity: "Quantity", unit: "Unit",
    estimatedPrice: "Est. unit price", purchased: "Purchased", convert: "Record as expense",
    actualPrice: "Actual unit price", noItems: "Shopping list is empty.", recurring: "Recurring bills",
    nextDue: "Next due", confirmPaid: "Confirm payment & record expense", noBills: "No scheduled bills.",
    reminders: "Due-date reminders appear here; a bill is never marked paid without your confirmation.",
    goalAdd: "Create savings goal", target: "Target amount", deadline: "Deadline",
    contribute: "Record contribution", noGoals: "No savings goals yet.",
    exportCsv: "Download CSV", printPdf: "Print / PDF", audit: "Activity log",
    language: "Language", english: "English", tamil: "தமிழ்", signOut: "Sign out",
    appUpdates: "App updates", installedVersion: "Installed version {version}",
    updateHelp: "Check the public GitHub release for a newer Android APK.",
    checkUpdates: "Check for updates", checkingUpdates: "Checking…",
    releaseNotFound: "No public latest release was found. The GitHub repository must be public and have a published stable APK release.",
    appUpToDate: "House Expense is up to date.",
    updateAvailable: "Version {version} is available. Download the APK and open it to install the update. Android may ask you to confirm; uninstalling should not be needed.",
    downloadUpdate: "Open APK download",
    budgetTitle: "Category budgets", addBudget: "Save budget", voice: "Voice entry",
    receiptDuplicate: "Possible duplicate receipt. Compare matching transaction before saving.",
    duplicate: "Possible duplicate", close: "Close", back: "Back", loading: "Loading your household…",
    noComparison: "No previous-month comparison yet.", budgetNotSet: "Add category budgets to set spending limits.",
    budgetExceeded: "{category} budget exceeded", budgetNear: "{category} budget nearly reached",
    budgetDetail: "{spent} spent across {count} purchases this month against a {limit} budget ({percent}%).",
    duplicateTitle: "Possible duplicate expense",
    duplicateDetail: "This {amount} {category} entry (“{description}”) on {date} matches another record within 14 days.",
    increaseTitle: "{category} spending is up month over month",
    increaseDetail: "{current} ({currentCount} entries) this month vs {prior} ({priorCount} entries) same period last month.",
    unusualTitle: "Unusually large {category} purchase",
    unusualDetail: "{amount} on {date} is at least 2.5× the {average} average of {count} prior purchases (last 90 days).",
    accountIntro: "Sign in to your household or create an account to get started.",
    securityNote: "Household memberships and financial records are protected by database row-level security.",
    elapsedComparison: "vs same days last month",
    expenseCount: "{count} recorded expenses",
    scheduledOnly: "Schedules a reminder only. No expense is created until you confirm payment.",
    convertAccounting: "Records one expense linked to this item. Repeating will not duplicate.",
    reimbursementNote: "Confirm amounts with your household before recording a repayment.",
    actualPaymentQuestion: "Confirm that “{title}” ({amount}) was paid? This records an expense.",
    reimbursementQuestion: "Confirm that you paid {name} {amount}?",
    noExpensesByOthers: "No personal-pocket expenses by other members recorded.",
    noReimbursements: "No reimbursements recorded yet.", recorded: "Recorded as expense",
    readyRecord: "Ready to record", noEstimate: "No estimate", each: "each",
    cadenceWeekly: "Weekly", cadenceMonthly: "Monthly", cadenceYearly: "Yearly",
    upcomingBills: "Upcoming bills", overdue: "Overdue", dueSoon: "Due soon",
    reminderNotice: "Bills due soon or overdue appear here. Payment requires explicit confirmation.",
    sharedListCount: "{count} items on shared list", personalPayments: "Personal payments and reimbursements",
    ledgerExplain: "Compares each member's personal-pocket expenses with reimbursements recorded to them.",
    due: "Due", noDeadline: "No deadline", saved: "saved", monthSummary: "Monthly summary",
    expenseDetail: "Expense detail", changeDetails: "Change details", noAudit: "No audited changes yet.",
    monthlyLimit: "Monthly limit", generated: "Generated", view: "Open", personalTag: "Personal",
    actualAmountQuestion: "Confirm payment and record expense",
    confirmPaymentTitle: "Review actual payment",
    actualPaymentHelp: "Enter what you actually paid; saving records one authoritative expense.",
    paymentRecorded: "Confirmed payment and recorded actual expense.",
    accountCreate: "Account created. Please check your email to confirm before signing in.",
    notConfigured: "Connect Supabase to use House Expense",
    configHelp: "Add your project URL and anon key to supabase-config.js and apply migrations.",
    noHousehold: "Create a household or join one with an invite code to begin.",
    signUpSuccess: "Account created. If email confirmation is enabled, confirm your address and then sign in.",
    voiceTitle: "Voice expense entry", voiceLanguage: "Speech language", voiceIdle: "Tap the microphone and describe an expense.",
    voiceListening: "Recording… speak naturally, then stop.", voiceProcessing: "Processing recording…",
    voiceUploading: "Uploading audio securely…", voiceTranscribing: "Transcribing audio…",
    voiceReview: "Review the transcript and fields before recording.", voiceError: "Voice input stopped. Try again or enter manually.",
    voicePermission: "Microphone access was denied. Allow microphone access in browser settings.",
    voiceSecure: "Microphone requires HTTPS or localhost. Open over a secure connection.",
    voiceNoSpeech: "No speech was detected. Check microphone and try again.",
    voiceTranscript: "Recognized transcript", voiceStart: "Start recording", voiceStop: "Stop recording",
    voiceManual: "Enter manually", voiceReviewAction: "Review expense", voiceMissingAmount: "Couldn't identify an amount. Please enter it.",
    voicePayerUnknown: "Mentioned payer could not be matched. Please select payer.",
    voiceTryAgain: "Try voice again", voiceConsent: "I agree to send audio securely to Groq for transcription.",
    voiceConsentNote: "Audio is transcribed via Groq API. Nothing is recorded until you review and save.",
    voiceSend: "Transcribe", voiceRecordAgain: "Record again", voiceRecording: "Recording",
    voiceRecorded: "Recording ready to transcribe.", voiceUploadProgress: "Uploading {percent}%",
    voiceNoMicrophone: "No microphone found or could not be opened.",
    voiceUnsupportedFormat: "Browser audio format unsupported. Use a current browser or enter manually.",
    voiceTooLarge: "Recording is too large. Keep under one minute.",
    voiceRateLimited: "Voice transcription limit reached. Please wait before retrying.",
    voiceSessionExpired: "Session expired. Sign in again to transcribe.",
    voiceInvalidAudio: "Recording is empty or unsupported format.",
    voiceProviderError: "Transcription temporarily unavailable.",
    voiceProviderNotConfigured: "Transcription not configured on server (missing Groq API secret).",
    voiceProviderRateLimited: "Provider free-tier limit reached. Please retry later.",
    voiceProviderNetworkError: "Transcription server could not reach provider.",
    voiceNetworkError: "Could not reach transcription service.",
    voiceTimeout: "Transcription request timed out.",
    voiceFunctionNotDeployed: "Transcription Edge Function is not deployed.",
    voiceRequestBlocked: "Request blocked. Check Edge Function CORS configuration.",
    voiceRequestError: "Transcription request rejected.",
    voiceEmptyTranscript: "No speech recognized. Try in a quieter place.",
    voiceMoreTitle: "More", voiceMoreIntro: "Additional household tools, lists, and records.",
    voiceHousehold: "Household settings, rooms, and members",
    noRoom: "You do not belong to a household.", notifications: "Upcoming and overdue bills appear in the app.",
    rooms: "Rooms & Spaces", addRoom: "Add room", editRoom: "Edit room", deleteRoom: "Delete room",
    roomNameField: "Room name", reassignExpensesTo: "Reassign transactions to", leaveUnassigned: "Leave unassigned",
    paymentMethods: "Payment methods", customCategories: "Custom categories",
    addCategory: "Add category", addPaymentMethod: "Add payment method",
    membersTitle: "Household members", roleOwner: "Owner", roleMember: "Member",
    removeMember: "Remove member", makeOwner: "Make owner", makeMember: "Make member",
    leaveHousehold: "Leave household", deleteHousehold: "Delete household",
    confirmDelete: "Are you sure you want to delete this?",
    confirmDeleteHousehold: "This will permanently delete this household and all associated financial records.",
    typeHouseholdNameToConfirm: "Type the household name to confirm deletion:",
    searchTransactions: "Search transactions…", allCategories: "All categories",
    allRooms: "All rooms", allPayers: "All payers", allFunding: "All funding",
    filterDateRange: "Date range", rangeThisMonth: "This month", rangeLastMonth: "Last month",
    rangeLast3Months: "Last 3 months", rangeAllTime: "All time",
    sortBy: "Sort by", sortNewest: "Date (Newest first)", sortOldest: "Date (Oldest first)",
    sortHighest: "Amount (Highest first)", sortLowest: "Amount (Lowest first)",
    notes: "Notes", paymentMethod: "Payment method",
    settlementsHistory: "Settlement history", reverseSettlement: "Reverse settlement",
    allTransactions: "All transactions", reimbursementsTab: "Settlements",
    spendingAlertsTitle: "Spending alerts", addAlert: "Add spending alert",
    threshold: "Threshold amount (₹)", active: "Active", paused: "Paused",
    clearCompleted: "Clear completed items", confirmClearCompleted: "Remove all purchased items from the list?",
    pauseBill: "Pause bill", resumeBill: "Resume bill",
    peopleInHouse: "{count} people in this house", personInHouse: "1 person in this house",
    peopleInRoom: "{count} people in this room", personInRoom: "1 person in this room"
  },
  ta: {
    home: "முகப்பு", insights: "நுண்ணறிவுகள்", ledger: "பரிவர்த்தனைகள்", groceries: "மளிகை", calendar: "நாள்காட்டி",
    bills: "கட்டணங்கள்", goals: "சேமிப்பு", reports: "அறிக்கைகள்", settings: "அமைப்புகள்",
    household: "குடும்பம்", more: "மேலும்", spent: "இந்த மாதச் செலவு", recent: "சமீபத்திய செலவுகள்",
    calendarSubtitle: "தேதி வாரியான தினசரி செலவு",
    addExpense: "செலவைச் சேர்", editExpense: "செலவைத் திருத்து", deleteExpense: "செலவை நீக்கு",
    expenseDetails: "செலவு விவரம்", signIn: "உள்நுழை", signUp: "கணக்கை உருவாக்கு",
    email: "மின்னஞ்சல்", password: "கடவுச்சொல்", name: "உங்கள் பெயர்", roomSetup: "குடும்பத்தை உருவாக்கு/சேர்",
    createRoom: "குடும்பத்தை உருவாக்கு", joinRoom: "அழைப்புக் குறியீட்டுடன் சேர்", roomName: "குடும்பப் பெயர்",
    invite: "அழைப்புக் குறியீடு", switchRoom: "உங்கள் குடும்பங்கள்", createAnotherRoom: "மற்றொரு குடும்பத்தை உருவாக்கு",
    joinAnotherRoom: "மற்றொரு குடும்பத்தில் சேர்", roomsHelp: "குடும்பங்களை நிர்வகிக்கவும் அல்லது மாறவும்.",
    roomCreated: "குடும்பம் உருவாக்கப்பட்டது.", roomJoined: "குடும்பத்தில் சேர்ந்தீர்கள்.",
    categoryBreakdown: "வகை வாரியான செலவு", remainingBudget: "மீதம் உள்ளது", darkTheme: "இருண்ட தோற்றம்", lightTheme: "ஒளி தோற்றம்",
    monthlyBudget: "மாதாந்திர வரவுசெலவு",
    explainAlerts: "பதிவு செய்யப்பட்ட பரிவர்த்தனைகளின் அடிப்படையில் எச்சரிக்கைகள் காட்டப்படும்.",
    noAlerts: "தற்போது செலவு எச்சரிக்கைகள் இல்லை.", noExpenses: "செலவுகள் எதுவும் பதிவு செய்யப்படவில்லை.",
    paidBy: "செலுத்தியவர்", amount: "தொகை", category: "வகை", description: "விவரம்",
    date: "தேதி", funding: "பணம்", personal: "சொந்தப் பணம்", shared: "குடும்பப் பணம்",
    save: "சேமி", cancel: "ரத்து", delete: "நீக்கு", edit: "திருத்து", undo: "மீட்டமை", receipt: "ரசீதை ஸ்கேன் செய்",
    cameraGallery: "கேமரா அல்லது படங்கள்", groceryAdd: "பொருளைச் சேர்", quantity: "அளவு", unit: "அலகு",
    estimatedPrice: "மதிப்பிடப்பட்ட விலை", purchased: "வாங்கப்பட்டது", convert: "செலவாகப் பதிவு செய்",
    actualPrice: "உண்மையான விலை", noItems: "மளிகைப் பட்டியல் காலியாக உள்ளது.", recurring: "தொடர் கட்டணங்கள்",
    nextDue: "அடுத்த தவணை", confirmPaid: "கட்டணத்தை உறுதிசெய்", noBills: "திட்டமிட்ட கட்டணங்கள் இல்லை.",
    reminders: "செலுத்த வேண்டிய தேதிகள் இங்கே தெரியும்.", goalAdd: "சேமிப்பு இலக்கு", target: "இலக்கு தொகை",
    deadline: "கடைசி நாள்", contribute: "சேமிப்பைப் பதிவு செய்", noGoals: "சேமிப்பு இலக்குகள் இல்லை.",
    exportCsv: "CSV பதிவிறக்கு", printPdf: "PDF அச்சிடு", audit: "செயல்பாட்டுப் பதிவு",
    language: "மொழி", english: "English", tamil: "தமிழ்", signOut: "வெளியேறு",
    appUpdates: "செயலி புதுப்பிப்பு", installedVersion: "நிறுவிய பதிப்பு {version}",
    updateHelp: "புதிய Android APK-ஐ பொது GitHub வெளியீட்டில் சரிபார்க்கவும்.",
    checkUpdates: "புதுப்பிப்புகளைச் சரிபார்", checkingUpdates: "சரிபார்க்கிறது…",
    releaseNotFound: "பொது சமீபத்திய வெளியீடு இல்லை. GitHub களஞ்சியம் பொதுவாகவும் நிலையான APK வெளியீடு வெளியிடப்பட்டதாகவும் இருக்க வேண்டும்.",
    appUpToDate: "House Expense ஏற்கனவே புதுப்பித்த நிலையில் உள்ளது.",
    updateAvailable: "பதிப்பு {version} கிடைக்கிறது. APK-ஐ பதிவிறக்கி திறந்து நிறுவவும். Android உறுதிப்படுத்தக் கேட்கலாம்; செயலியை நீக்கத் தேவையில்லை.",
    downloadUpdate: "APK பதிவிறக்கத்தைத் திற",
    budgetTitle: "வரவுசெலவுத் திட்டம்", addBudget: "வரம்பைச் சேமி", voice: "குரல் பதிவு",
    receiptDuplicate: "இதேபோன்ற ரசீது உள்ளது.", duplicate: "நகல் இருக்கலாம்", close: "மூடு", back: "திரும்பு",
    loading: "விவரங்கள் ஏற்றப்படுகின்றன…", noComparison: "ஒப்பீடு செய்ய தரவு இல்லை.", budgetNotSet: "செலவு வரம்புகளை அமைக்கவும்.",
    budgetExceeded: "{category} வரம்பு மீறப்பட்டது", budgetNear: "{category} வரம்பு நெருங்கிவிட்டது",
    budgetDetail: "{spent} செலவாகியுள்ளது; வரம்பு {limit} ({percent}%).",
    duplicateTitle: "நகல் செலவு இருக்கலாம்", duplicateDetail: "{date} அன்று {amount} செலவு மற்றொரு பதிவுடன் பொருந்துகிறது.",
    increaseTitle: "{category} செலவு அதிகரித்துள்ளது", increaseDetail: "இந்த மாதம் {current} vs கடந்த மாதம் {prior}.",
    unusualTitle: "அதிகமான வாங்குதல்", unusualDetail: "{date} அன்று {amount} வழக்கத்தை விட அதிகம்.",
    accountIntro: "தொடங்க உள்நுழையவும் அல்லது கணக்கை உருவாக்கவும்.",
    securityNote: "நிதிப் பதிவுகள் தரவுத்தள வரிசை-நிலை பாதுகாப்பால் பாதுகாக்கப்படுகின்றன.",
    elapsedComparison: "கடந்த மாதத்துடன் ஒப்பீடு", expenseCount: "{count} செலவுகள்",
    scheduledOnly: "நினைவூட்டல் மட்டுமே. செலவு உருவாகாது.", convertAccounting: "ஒரே ஒரு செலவு பதிவாகும்.",
    reimbursementNote: "பணத்தைத் திருப்பிச் செலுத்துவதை உறுதிப்படுத்தவும்.",
    actualPaymentQuestion: "“{title}” ({amount}) செலுத்தப்பட்டதா?", reimbursementQuestion: "{name} அவர்களுக்கு {amount} செலுத்தினீர்களா?",
    noExpensesByOthers: "சொந்தப் பணச் செலவுகள் இல்லை.", noReimbursements: "திருப்பிச் செலுத்தல்கள் இல்லை.",
    recorded: "செலவாகப் பதிவானது", readyRecord: "பதிவு செய்யலாம்", noEstimate: "மதிப்பீடு இல்லை", each: "ஒவ்வொன்றும்",
    cadenceWeekly: "வாரந்தோறும்", cadenceMonthly: "மாதந்தோறும்", cadenceYearly: "ஆண்டுதோறும்",
    upcomingBills: "வரவிருக்கும் கட்டணங்கள்", overdue: "காலாவதியானது", dueSoon: "விரைவில் செலுத்தவேண்டியது",
    reminderNotice: "பணம் செலுத்தியதை உறுதிப்படுத்துவது அவசியம்.", sharedListCount: "பட்டியலில் {count} பொருட்கள்",
    personalPayments: "சொந்தப் பணச் செலவுகள் & திருப்பிச் செலுத்தல்கள்", ledgerExplain: "உறுப்பினர்களின் சொந்தப் பணச் செலவுகளையும் திருப்பிச் செலுத்தியதையும் ஒப்பிடுகிறது.",
    due: "கடைசி நாள்", noDeadline: "கடைசி நாள் இல்லை", saved: "சேமிக்கப்பட்டது", monthSummary: "மாதாந்திர சுருக்கம்",
    expenseDetail: "செலவு விவரம்", changeDetails: "மாற்ற விவரங்கள்", noAudit: "தணிக்கை பதிவுகள் இல்லை.",
    monthlyLimit: "மாதாந்திர வரம்பு", generated: "உருவாக்கப்பட்டது", view: "திற", personalTag: "சொந்தப் பணம்",
    actualAmountQuestion: "கட்டணத்தை உறுதிசெய்து பதிவு செய்", confirmPaymentTitle: "கட்டணத்தைச் சரிபார்க்கவும்",
    actualPaymentHelp: "செலுத்திய தொகையை உள்ளிடவும்.", paymentRecorded: "கட்டணம் பதிவு செய்யப்பட்டது.",
    accountCreate: "கணக்கு உருவாக்கப்பட்டது.", notConfigured: "Supabase இணைக்கவும்",
    configHelp: "supabase-config.js அமைக்கவும்.", noHousehold: "குடும்பத்தை உருவாக்கவும்.",
    signUpSuccess: "கணக்கு உருவாக்கப்பட்டது. உள்நுழையவும்.", voiceTitle: "குரல் மூலம் செலவு பதிவு",
    voiceLanguage: "மொழி", voiceIdle: "மைக்ரோஃபோனைத் தொட்டு செலவைச் சொல்லுங்கள்.", voiceListening: "பதிவு செய்கிறது…",
    voiceProcessing: "செயலாக்கப்படுகிறது…", voiceUploading: "பதிவேற்றப்படுகிறது…", voiceTranscribing: "உரையாக மாற்றப்படுகிறது…",
    voiceReview: "விவரங்களைச் சரிபார்க்கவும்.", voiceError: "குரல் பதிவு நிறுத்தப்பட்டது.",
    voicePermission: "மைக்ரோஃபோன் அனுமதி தேவை.", voiceSecure: "HTTPS இணைப்பு தேவை.",
    voiceNoSpeech: "குரல் கண்டறியப்படவில்லை.", voiceTranscript: "அறியப்பட்ட உரை",
    voiceStart: "பதிவைத் தொடங்கு", voiceStop: "பதிவை நிறுத்து", voiceManual: "கைமுறையாக உள்ளிடவும்",
    voiceReviewAction: "சரிபார்", voiceMissingAmount: "தொகையை உள்ளிடவும்.", voicePayerUnknown: "பணம் செலுத்தியவரைத் தேர்ந்தெடுக்கவும்.",
    voiceTryAgain: "மீண்டும் முயற்சி", voiceConsent: "Groq-க்கு பாதுகாப்பாக அனுப்ப ஒப்புக்கொள்கிறேன்.",
    voiceConsentNote: "ஒலி உரையாக்க Groq API-க்கு அனுப்பப்படும்.", voiceSend: "உரையாக்கு",
    voiceRecordAgain: "மீண்டும் பதிவு செய்", voiceRecording: "பதிவு", voiceRecorded: "தயாராக உள்ளது.",
    voiceUploadProgress: "பதிவேற்றம் {percent}%", voiceNoMicrophone: "மைக்ரோஃபோன் கிடைக்கவில்லை.",
    voiceUnsupportedFormat: "ஆதரிக்கப்படாத ஒலி வடிவம்.", voiceTooLarge: "பதிவு மிகப் பெரியது.",
    voiceRateLimited: "வரம்பை அடைந்துவிட்டது.", voiceSessionExpired: "உள்நுழைவு காலாவதியானது.",
    voiceInvalidAudio: "தவறான ஒலி வடிவம்.", voiceProviderError: "தற்காலிகமாக கிடைக்கவில்லை.",
    voiceProviderNotConfigured: "Groq ரகசியம் அமைக்கப்படவில்லை.", voiceProviderRateLimited: "இலவச வரம்பு முடிந்தது.",
    voiceProviderNetworkError: "இணைப்புப் பிழை.", voiceNetworkError: "சேவை அணுக முடியவில்லை.",
    voiceTimeout: "நேரம் கடந்துவிட்டது.", voiceFunctionNotDeployed: "செயல்பாடு நிறுவப்படவில்லை.",
    voiceRequestBlocked: "பதிவேற்றம் தடுக்கப்பட்டது.", voiceRequestError: "கோரிக்கை ஏற்கப்படவில்லை.",
    voiceEmptyTranscript: "பேச்சு எதுவும் அறியப்படவில்லை.", voiceMoreTitle: "மேலும்",
    voiceMoreIntro: "கூடுதல் குடும்பக் கருவிகள்.", voiceHousehold: "குடும்ப அமைப்புகள் மற்றும் அறைகள்",
    noRoom: "குடும்பத்தில் சேரவில்லை.", notifications: "அறிவிப்புகள் செயலியில் தெரியும்.",
    rooms: "அறைகள் & இடங்கள்", addRoom: "அறையைச் சேர்", editRoom: "அறையைத் திருத்து", deleteRoom: "அறையை நீக்கு",
    roomNameField: "அறைப் பெயர்", reassignExpensesTo: "செலவுகளை மாற்ற வேண்டிய அறை", leaveUnassigned: "ஒதுக்கப்படாமல் விடு",
    paymentMethods: "செலுத்தும் வழிகள்", customCategories: "தனிப்பயன் வகைகள்",
    addCategory: "வகையைச் சேர்", addPaymentMethod: "வழியைச் சேர்",
    membersTitle: "குடும்ப உறுப்பினர்கள்", roleOwner: "உரிமையாளர்", roleMember: "உறுப்பினர்",
    removeMember: "உறுப்பினரை நீக்கு", makeOwner: "உரிமையாளராக்கு", makeMember: "உறுப்பினராக்கு",
    leaveHousehold: "குடும்பத்திலிருந்து வெளியேறு", deleteHousehold: "குடும்பத்தை நீக்கு",
    confirmDelete: "நிச்சயமாக நீக்க வேண்டுமா?",
    confirmDeleteHousehold: "இது குடும்பத்தையும் அனைத்து நிதிப் பதிவுகளையும் நிரந்தரமாக நீக்கும்.",
    typeHouseholdNameToConfirm: "உறுதிப்படுத்த குடும்பப் பெயரை உள்ளிடவும்:",
    searchTransactions: "பரிவர்த்தனைகளைத் தேடுக…", allCategories: "அனைத்து வகைகள்",
    allRooms: "அனைத்து அறைகள்", allPayers: "அனைத்து நபர்கள்", allFunding: "அனைத்து நிதி வழிகள்",
    filterDateRange: "தேதி வரம்பு", rangeThisMonth: "இந்த மாதம்", rangeLastMonth: "கடந்த மாதம்",
    rangeLast3Months: "கடந்த 3 மாதங்கள்", rangeAllTime: "எல்லா நேரமும்",
    sortBy: "வரிசைப்படுத்து", sortNewest: "தேதி (புதியவை முதலில்)", sortOldest: "தேதி (பழையவை முதலில்)",
    sortHighest: "தொகை (அதிகம்)", sortLowest: "தொகை (குறைவு)",
    notes: "குறிப்புகள்", paymentMethod: "செலுத்தும் முறை",
    settlementsHistory: "திருப்பிச் செலுத்திய வரலாறு", reverseSettlement: "ரத்து செய்",
    allTransactions: "அனைத்து செலவுகள்", reimbursementsTab: "திருப்பிச் செலுத்துதல்",
    spendingAlertsTitle: "செலவு எச்சரிக்கைகள்", addAlert: "எச்சரிக்கையைச் சேர்",
    threshold: "வரம்புத் தொகை (₹)", active: "செயலில்", paused: "நிறுத்தப்பட்டது",
    clearCompleted: "முடிந்தவற்றை நீக்கு", confirmClearCompleted: "வாங்கப்பட்ட அனைத்துப் பொருட்களையும் நீக்கவா?",
    pauseBill: "கட்டணத்தை நிறுத்து", resumeBill: "கட்டணத்தைத் தொடர்",
    peopleInHouse: "இந்த வீட்டில் {count} நபர்கள்", personInHouse: "இந்த வீட்டில் 1 நபர்",
    peopleInRoom: "இந்த அறையில் {count} நபர்கள்", personInRoom: "இந்த அறையில் 1 நபர்"
  }
};

const tr = key => T[state.profile?.language || "en"]?.[key] || T.en[key] || key;
const tx = (key, values) => Object.entries(values).reduce((text, [name, value]) =>
  text.replaceAll(`{${name}}`, String(value)), tr(key));

function formatPeopleInHouse(count) {
  if (count === 1) return tr("personInHouse");
  return tx("peopleInHouse", { count });
}

function formatPeopleInRoom(count) {
  if (count === 1) return tr("personInRoom");
  return tx("peopleInRoom", { count });
}

const BUILTIN_CATEGORIES = [
  ["veg", "Vegetables", "carrot"], ["groc", "Groceries", "basket"],
  ["milk", "Milk & dairy", "milk"], ["snk", "Snacks", "cookie"],
  ["bill", "Bills & Utilities", "receipt"], ["gas", "Cooking gas", "flame"],
  ["rent", "Rent & Housing", "building"], ["trans", "Transport & Fuel", "car"],
  ["shop", "Shopping", "bag"], ["fun", "Entertainment", "film"],
  ["home", "Household & Decor", "home"], ["hlth", "Health & Medicine", "cross"],
  ["oth", "Other", "tag"]
];

const CAT_TA = {
  veg: "காய்கறிகள்", groc: "மளிகைப் பொருட்கள்", milk: "பால் & பொருட்கள்",
  snk: "தின்பண்டங்கள்", bill: "கட்டணங்கள் & சேவை", gas: "சமையல் எரிவாயு",
  rent: "வாடகை", trans: "போக்குவரத்து", shop: "கடைகள்", fun: "பொழுதுபோக்கு",
  home: "வீட்டுப் பொருட்கள்", hlth: "மருத்துவம்", oth: "மற்றவை"
};

const BUILTIN_PAYMENT_METHODS = [
  ["cash", "Cash"], ["upi", "UPI / GPay / PhonePe"],
  ["cc", "Credit Card"], ["dc", "Debit Card"], ["bank", "Net Banking"]
];

const NAV = [
  ["home", "home"], ["ledger", "list"], ["insights", "pie"], ["household", "home-gear"], ["more", "dots"]
];

const state = {
  client: null,
  user: null,
  profile: null,
  households: [],
  room: null,
  members: [],
  expenses: [],
  budgets: [],
  bills: [],
  shopping: [],
  goals: [],
  contributions: [],
  settlements: [],
  activity: [],
  rooms: [],
  customCategories: [],
  paymentMethods: [],
  spendingAlerts: [],
  page: "home",
  calendarMonth: localMonthKey(),
  calendarSelectedDate: "",
  ledgerSubtab: "all", // "all" | "settlements"
  filter: {
    search: "",
    category: "",
    room: "",
    payer: "",
    funding: "",
    range: "thisMonth", // "thisMonth" | "lastMonth" | "last3Months" | "all"
    sort: "dateDesc", // "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc"
    page: 1,
    pageSize: 25
  },
  loading: false,
  subscription: null,
  toastTimer: null,
  undoAction: null,
  undoTimer: null,
  undoCountdownInterval: null,
  undoSecondsRemaining: 8,
  realtimeRefreshTimer: null,
  listening: null,
  receiptUrl: null,
  voice: null
};

function isHouseholdOwner() {
  return hasHouseholdOwnerRole(state.members, state.user?.id);
}

let voiceSequence = 0;

// FLASH & TOAST NOTIFICATIONS
function flash(message) {
  toastBox.innerHTML = `<div class="toast-body"><span>${esc(message)}</span></div>`;
  toastBox.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toastBox.classList.remove("show"), 4200);
}

function showUndoToast(message, undoCallback, durationSeconds = 8) {
  clearTimeout(state.undoTimer);
  clearInterval(state.undoCountdownInterval);
  state.undoSecondsRemaining = durationSeconds;
  state.undoAction = undoCallback;

  const renderToastContent = () => {
    toastBox.innerHTML = `
      <div class="toast-body">
        <div class="grow">
          <div>${esc(message)}</div>
          <div class="tiny muted">${state.undoSecondsRemaining}s to undo</div>
        </div>
        <button class="toast-undo-btn" type="button" data-action="trigger-undo">${tr("undo")}</button>
      </div>
      <div class="toast-timer-bar" style="transform: scaleX(${state.undoSecondsRemaining / durationSeconds}); transition: transform 1s linear;"></div>
    `;
  };

  renderToastContent();
  toastBox.classList.add("show");

  state.undoCountdownInterval = setInterval(() => {
    state.undoSecondsRemaining -= 1;
    if (state.undoSecondsRemaining <= 0) {
      clearInterval(state.undoCountdownInterval);
      state.undoAction = null;
      toastBox.classList.remove("show");
    } else {
      renderToastContent();
    }
  }, 1000);

  state.undoTimer = setTimeout(() => {
    toastBox.classList.remove("show");
    state.undoAction = null;
  }, durationSeconds * 1000);
}

function errorMessage(error) {
  if (error?.message) return error.message;
  return "Something went wrong. Please try again.";
}

function showError(error) {
  console.error("[House Expense]", error);
  flash(errorMessage(error));
}

// CATEGORIES & METHODS RESOLUTION
function allCategoriesList() {
  const custom = state.customCategories.filter(c => !c.deleted_at).map(c => [c.key, c.name, c.icon || "tag"]);
  return [...BUILTIN_CATEGORIES, ...custom];
}

function categoryName(id) {
  if (state.profile?.language === "ta" && CAT_TA[id]) return CAT_TA[id];
  const found = allCategoriesList().find(([key]) => key === id);
  return found ? found[1] : id;
}

function allPaymentMethodsList() {
  const custom = state.paymentMethods.filter(m => !m.deleted_at).map(m => [m.key, m.name]);
  return [...BUILTIN_PAYMENT_METHODS, ...custom];
}

function paymentMethodName(key) {
  const found = allPaymentMethodsList().find(([id]) => id === key);
  return found ? found[1] : (key || "Cash");
}

function roomName(roomId) {
  if (!roomId) return "";
  const r = state.rooms.find(room => room.id === roomId);
  return r ? r.name : "";
}

function profileName(userId) {
  return state.members.find(member => member.user_id === userId)?.name ||
    (userId === state.user?.id ? state.profile?.display_name : "") ||
    `${String(userId || "").slice(0, 6)}…`;
}

function monthExpenses(shift = 0) {
  const start = monthStart(shift);
  const end = monthStart(shift + 1);
  return state.expenses.filter(e => !e.deleted_at && e.occurred_on >= start && e.occurred_on < end);
}

function memberSelect(selected = state.user?.id, name = "paid_by") {
  return `<select class="field" name="${name}" required>
    ${selected ? "" : `<option value="">Select member</option>`}
    ${state.members.map(member => `<option value="${esc(member.user_id)}" ${member.user_id === selected ? "selected" : ""}>${esc(member.name)}</option>`).join("")}
  </select>`;
}

function roomSelect(selected = "", name = "room_id") {
  return `<select class="field" name="${name}">
    <option value="">None / Common area</option>
    ${state.rooms.filter(r => !r.deleted_at).map(room => `<option value="${esc(room.id)}" ${room.id === selected ? "selected" : ""}>${esc(room.name)}</option>`).join("")}
  </select>`;
}

function paymentMethodSelect(selected = "cash", name = "payment_method") {
  return `<select class="field" name="${name}">
    ${allPaymentMethodsList().map(([id, label]) => `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(label)}</option>`).join("")}
  </select>`;
}

function renderConfigError(error) {
  app.innerHTML = `<section class="panel"><h1>${tr("notConfigured")}</h1>
    <p>${tr("configHelp")}</p><p class="small muted">${esc(error.message)}</p></section>`;
}

function renderAuth() {
  app.innerHTML = `
    <div style="min-height:85dvh; display:flex; flex-direction:column; justify-content:center;">
      <section class="panel" style="max-width:440px; margin:0 auto; width:100%;">
        <div style="text-align:center; margin-bottom:20px;">
          <img class="auth-logo" src="./icons/hearth-mark.png" alt="">
          <h2 class="hd" style="font-size:24px; margin:0 0 16px;">House Expense</h2>
          <h1 class="hd" style="font-size:26px;">A calmer way to share expenses.</h1>
          <p class="muted small">${tr("accountIntro")}</p>
        </div>
        <div class="pill-tabs">
          <button class="on" type="button" data-action="auth-tab" data-value="signin">${tr("signIn")}</button>
          <button type="button" data-action="auth-tab" data-value="signup">${tr("signUp")}</button>
        </div>
        <form data-form="auth" data-mode="signin">
          <label class="field-label">${tr("name")}<input class="field" name="display_name" autocomplete="name" maxlength="80" placeholder="e.g. Anand"></label>
          <label class="field-label">${tr("email")}<input class="field" name="email" type="email" autocomplete="email" required placeholder="you@family.com"></label>
          <label class="field-label">${tr("password")}<input class="field" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          <button class="button primary" type="submit">${tr("signIn")}</button>
        </form>
        <p class="small muted" style="margin-top:16px; text-align:center;">${tr("securityNote")}</p>
      </section>
    </div>
  `;
}

function renderOnboarding() {
  app.innerHTML = `
    <header class="top">
      <div>
        <div class="brand-chip"><img class="brand-mark" src="./icons/hearth-mark.png" alt=""> HOUSE EXPENSE</div>
        <h1>${tr("roomSetup")}</h1>
      </div>
      <button class="button sm" data-action="signout">${tr("signOut")}</button>
    </header>
    <p class="muted">${tr("noHousehold")}</p>
    <div class="grid-two">
      <section class="panel">
        <form data-form="create-room">
          <h3>${tr("createRoom")}</h3>
          <p class="small muted">Start a brand new household for your home.</p>
          <label class="field-label">${tr("roomName")}<input class="field" name="name" maxlength="80" placeholder="e.g. Palm Grove Villa" required></label>
          <button class="button primary">${tr("createRoom")}</button>
        </form>
      </section>
      <section class="panel">
        <form data-form="join-room">
          <h3>${tr("joinRoom")}</h3>
          <p class="small muted">Enter an invite code provided by a family member.</p>
          <label class="field-label">${tr("invite")}<input class="field" name="invite" maxlength="20" placeholder="e.g. A1B2C3D4" required></label>
          <button class="button primary">${tr("joinRoom")}</button>
        </form>
      </section>
    </div>
  `;
}

function renderNav() {
  const icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    pie: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
    "home-gear": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    dots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`
  };

  return `
    <nav class="nav" aria-label="Main navigation">
      ${NAV.map(([page, iconKey]) => `
        <button type="button" class="${(state.page === page || (page === "household" && state.page === "settings")) ? "on" : ""}" data-action="navigate" data-value="${page}" aria-current="${state.page === page ? "page" : "false"}">
          <span class="nav-icon" aria-hidden="true">${icons[iconKey]}</span>
          <span>${esc(tr(page))}</span>
        </button>
      `).join("")}
    </nav>
    <button class="fab no-print" aria-label="${tr("addExpense")}" data-action="expense">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  `;
}

// 1. DASHBOARD VIEW (HOME)
function renderHome() {
  const expenses = monthExpenses();
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const limit = state.budgets.reduce((sum, b) => sum + Number(b.monthly_limit), 0);
  const elapsedDays = new Date().getDate();
  const previous = monthExpenses(-1).filter(e => Number(e.occurred_on.slice(-2)) <= elapsedDays)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const change = previous ? Math.round((total - previous) / previous * 100) : null;
  const percent = limit ? Math.min(100, Math.round(total / limit * 100)) : 0;

  const categoryTotals = calculateCategoryBreakdown(expenses).slice(0, 5);
  const roomTotals = calculateRoomBreakdown(expenses, state.rooms).slice(0, 4);
  const importantAlerts = alertRows().filter(alert => alert.level).slice(0, 2);
  const recent = state.expenses.filter(e => !e.deleted_at).slice(0, 6);
  const soon = state.bills.filter(b => !b.deleted_at && b.active && b.next_due <= localIsoDate(new Date(Date.now() + 7 * 86400000))).slice(0, 3);
  const pendingGroceries = state.shopping.filter(i => !i.deleted_at && !i.purchased).length;
  const reimbursements = isHouseholdOwner() ? calculatePersonalReimbursements({
    members: state.members, expenses: state.expenses, settlements: state.settlements, currentUserId: state.user.id
  }) : [];
  const totalOwed = reimbursements.reduce((sum, r) => sum + r.outstanding, 0);

  return `
    <header class="top">
      <div>
        <div class="brand-chip"><img class="brand-mark" src="./icons/hearth-mark.png" alt=""> ${esc(state.room.name)} · 👥 ${formatPeopleInHouse(state.members.length)}</div>
        <h1 class="hd">${esc(tr("home"))}</h1>
      </div>
      <button class="household-picker-btn" type="button" data-action="navigate" data-value="household">
        <span class="avatar sm" style="width:28px; height:28px; font-size:12px;">${esc((state.profile?.display_name || state.user?.email || "H")[0].toUpperCase())}</span>
        <span>${esc(state.profile?.display_name || "Profile")}</span>
      </button>
    </header>

    <section class="hero">
      <div class="between">
        <span class="muted small">${tr("spent")} (${new Date().toLocaleDateString(locale(), { month: "long" })})</span>
        ${change !== null ? `<span class="tag ${change > 15 ? "warn" : "neutral"} small">${change >= 0 ? "+" : ""}${change}% ${tr("elapsedComparison")}</span>` : ""}
      </div>
      <div class="amount">${money(total)}</div>

      <div class="house-members-bar" style="display:flex; align-items:center; gap:8px; margin:8px 0 12px; padding:6px 12px; background:rgba(255,255,255,0.08); border-radius:var(--radius-md); font-size:13px; color:#e2e8f0;">
        <div style="display:flex; align-items:center;">
          ${state.members.slice(0, 5).map((m, idx) => `
            <div title="${esc(m.name)}" style="width:24px; height:24px; border-radius:50%; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:10px; font-weight:700; margin-left:${idx === 0 ? "0" : "-6px"}; border:2px solid var(--hero); flex:none;">${esc((m.name || "U")[0].toUpperCase())}</div>
          `).join("")}
        </div>
        <span><strong>👥 ${formatPeopleInHouse(state.members.length)}</strong> <span style="opacity:0.85;">(${state.members.map(m => esc(m.name)).slice(0, 3).join(", ")}${state.members.length > 3 ? ` +${state.members.length - 3}` : ""})</span></span>
      </div>

      ${limit ? `
        <div class="between small">
          <span>${money(total)} / ${money(limit)} · ${tr("monthlyBudget")}</span>
          <strong>${percent}%</strong>
        </div>
        <div class="budget-bar"><i style="width:${percent}%" class="${percent >= 90 ? "warn" : ""}"></i></div>
        <div class="small" style="margin-top:6px; color:#cbd5e1;">${money(Math.max(0, limit - total))} ${tr("remainingBudget")}</div>
      ` : `
        <div class="small muted">${tr("budgetNotSet")} <button class="button sm soft" style="margin-left:8px;" data-action="navigate" data-value="household">+ Add</button></div>
      `}

      <div class="hero-quick-actions">
        <button class="quick-btn" type="button" data-action="expense">
          <span class="quick-btn-icon">＋</span><span>${tr("addExpense")}</span>
        </button>
        <button class="quick-btn" type="button" data-action="voice">
          <span class="quick-btn-icon">🎙</span><span>${tr("voice")}</span>
        </button>
        <button class="quick-btn" type="button" data-action="navigate" data-value="groceries">
          <span class="quick-btn-icon">🛒</span><span>${tr("groceries")}</span>
        </button>
        <button class="quick-btn" type="button" data-action="navigate" data-value="bills">
          <span class="quick-btn-icon">🗓</span><span>${tr("bills")}</span>
        </button>
      </div>
    </section>

    ${totalOwed > 0 ? `
      <section class="card notice warn" style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <strong>${money(totalOwed)} in personal settlements pending</strong>
          <div class="small">${reimbursements.length} household member(s) paid from their personal pockets.</div>
        </div>
        <button class="button sm primary" data-action="navigate-ledger-settlements">${tr("view")}</button>
      </section>
    ` : ""}

    ${importantAlerts.length ? `
      <section class="panel">
        <div class="between">
          <h3 style="display:flex; align-items:center; gap:6px;">⚠️ ${tr("insights")}</h3>
          <button class="button sm soft" data-action="navigate" data-value="insights">${tr("view")}</button>
        </div>
        ${importantAlerts.map(alert => `
          <div class="notice warn" style="margin:8px 0 0;">
            <strong>${esc(alert.title)}</strong>
            <div class="small">${esc(alert.detail)}</div>
          </div>
        `).join("")}
      </section>
    ` : ""}

    ${categoryTotals.length ? `
      <section class="panel">
        <div class="between">
          <h3>${tr("categoryBreakdown")}</h3>
          <span class="small muted">${categoryTotals.length} categories</span>
        </div>
        ${categoryTotals.map(([catId, amt]) => `
          <div style="margin:12px 0 6px;">
            <div class="between small">
              <span>${esc(categoryName(catId))}</span>
              <strong>${money(amt)}</strong>
            </div>
            <div class="budget-bar" style="height:6px; background:var(--tint); margin-top:4px;">
              <i style="width:${total ? Math.min(100, (amt / total) * 100) : 0}%;"></i>
            </div>
          </div>
        `).join("")}
      </section>
    ` : ""}

    ${roomTotals.length > 1 || (roomTotals.length === 1 && roomTotals[0].roomId) ? `
      <section class="panel">
        <div class="between">
          <h3>${tr("rooms")}</h3>
          <button class="button sm soft" data-action="navigate" data-value="household">${tr("edit")}</button>
        </div>
        <div class="grid-two" style="margin-top:10px;">
          ${roomTotals.map(r => `
            <div class="card" style="margin:0; padding:12px;">
              <div class="between">
                <strong>${esc(r.name)}</strong>
                <span class="money">${money(r.total)}</span>
              </div>
              <div class="small muted" style="margin-top:4px;">👥 ${formatPeopleInRoom(r.peopleCount)} · ${r.count} expense(s)</div>
            </div>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${soon.length ? `
      <section class="panel">
        <div class="between">
          <h3>${tr("upcomingBills")}</h3>
          <button class="button sm soft" data-action="navigate" data-value="bills">${tr("view")}</button>
        </div>
        ${soon.map(bill => `
          <div class="list-row">
            <div class="grow">
              <strong>${esc(bill.title)}</strong>
              <div class="small muted">${dateLabel(bill.next_due)} · ${bill.next_due < today() ? `<span class="tag warn small">${tr("overdue")}</span>` : `<span class="tag small">${tr("dueSoon")}</span>`}</div>
            </div>
            <div class="money">${money(bill.amount)}</div>
          </div>
        `).join("")}
      </section>
    ` : ""}

    <section class="panel">
      <div class="between">
        <h3>${tr("recent")}</h3>
        <button class="button sm soft" data-action="navigate" data-value="ledger">${tr("view")}</button>
      </div>
      ${recent.length ? `<div class="list">${recent.map(e => expenseRow(e, false, true)).join("")}</div>` : `<div class="empty">${tr("noExpenses")}</div>`}
    </section>

    <section class="card between">
      <div>
        <h3>${tr("groceries")}</h3>
        <div class="small muted">${tx("sharedListCount", { count: pendingGroceries })}</div>
      </div>
      <button class="button soft sm" data-action="navigate" data-value="groceries">${tr("view")}</button>
    </section>
  `;
}

// 2. TRANSACTIONS VIEW (LEDGER + ALL TRANSACTIONS)
function renderLedger() {
  const isOwner = isHouseholdOwner();
  const isSettlements = isOwner && state.ledgerSubtab === "settlements";
  const personal = isOwner ? calculatePersonalReimbursements({
    members: state.members, expenses: state.expenses, settlements: state.settlements, currentUserId: state.user.id
  }) : [];
  const settled = isOwner ? state.settlements.filter(s => !s.deleted_at) : [];

  // Filtered transactions logic
  let filtered = state.expenses.filter(e => !e.deleted_at);
  const f = state.filter;

  if (f.search) {
    const q = f.search.toLowerCase();
    filtered = filtered.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      categoryName(e.category).toLowerCase().includes(q) ||
      profileName(e.paid_by).toLowerCase().includes(q)
    );
  }
  if (f.category) filtered = filtered.filter(e => e.category === f.category);
  if (f.room) filtered = filtered.filter(e => e.room_id === f.room);
  if (f.payer) filtered = filtered.filter(e => e.paid_by === f.payer);
  if (f.funding) filtered = filtered.filter(e => e.funding === f.funding);

  if (f.range === "thisMonth") {
    const start = monthStart(0);
    filtered = filtered.filter(e => e.occurred_on >= start);
  } else if (f.range === "lastMonth") {
    const start = monthStart(-1);
    const end = monthStart(0);
    filtered = filtered.filter(e => e.occurred_on >= start && e.occurred_on < end);
  } else if (f.range === "last3Months") {
    const start = monthStart(-2);
    filtered = filtered.filter(e => e.occurred_on >= start);
  }

  // Sorting
  filtered.sort((a, b) => {
    if (f.sort === "dateAsc") return a.occurred_on.localeCompare(b.occurred_on);
    if (f.sort === "amountDesc") return Number(b.amount) - Number(a.amount);
    if (f.sort === "amountAsc") return Number(a.amount) - Number(b.amount);
    return b.occurred_on.localeCompare(a.occurred_on); // dateDesc default
  });

  const totalFilteredAmount = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / f.pageSize));
  const currentPage = Math.min(f.page, totalPages);
  const pagedExpenses = filtered.slice((currentPage - 1) * f.pageSize, currentPage * f.pageSize);

  return `
    <header class="top">
      <div>
        <div class="brand-chip">${esc(state.room.name)}</div>
        <h1 class="hd">${esc(tr("ledger"))}</h1>
      </div>
      <button class="button sm soft" data-action="expense">＋ ${tr("addExpense")}</button>
    </header>

    <div class="pill-tabs">
      <button class="${!isSettlements ? "on" : ""}" data-action="ledger-tab" data-value="all">${tr("allTransactions")}</button>
      ${isOwner ? `<button class="${isSettlements ? "on" : ""}" data-action="ledger-tab" data-value="settlements">${tr("reimbursementsTab")} ${personal.length ? `(${personal.length})` : ""}</button>` : ""}
    </div>

    ${!isSettlements ? `
      <section class="panel" style="margin-top:0;">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input class="field sm" type="search" placeholder="${esc(tr("searchTransactions"))}" value="${esc(f.search)}" data-action="filter-search">
        </div>

        <div class="filter-bar">
          <select class="field sm" data-action="filter-category" style="width:auto; min-width:130px;">
            <option value="">${tr("allCategories")}</option>
            ${allCategoriesList().map(([id]) => `<option value="${id}" ${f.category === id ? "selected" : ""}>${esc(categoryName(id))}</option>`).join("")}
          </select>

          ${state.rooms.length ? `
            <select class="field sm" data-action="filter-room" style="width:auto; min-width:110px;">
              <option value="">${tr("allRooms")}</option>
              ${state.rooms.filter(r => !r.deleted_at).map(r => `<option value="${r.id}" ${f.room === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
            </select>
          ` : ""}

          <select class="field sm" data-action="filter-payer" style="width:auto; min-width:110px;">
            <option value="">${tr("allPayers")}</option>
            ${state.members.map(m => `<option value="${m.user_id}" ${f.payer === m.user_id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}
          </select>

          <select class="field sm" data-action="filter-range" style="width:auto; min-width:110px;">
            <option value="thisMonth" ${f.range === "thisMonth" ? "selected" : ""}>${tr("rangeThisMonth")}</option>
            <option value="lastMonth" ${f.range === "lastMonth" ? "selected" : ""}>${tr("rangeLastMonth")}</option>
            <option value="last3Months" ${f.range === "last3Months" ? "selected" : ""}>${tr("rangeLast3Months")}</option>
            <option value="all" ${f.range === "all" ? "selected" : ""}>${tr("rangeAllTime")}</option>
          </select>

          <select class="field sm" data-action="filter-sort" style="width:auto; min-width:130px;">
            <option value="dateDesc" ${f.sort === "dateDesc" ? "selected" : ""}>${tr("sortNewest")}</option>
            <option value="dateAsc" ${f.sort === "dateAsc" ? "selected" : ""}>${tr("sortOldest")}</option>
            <option value="amountDesc" ${f.sort === "amountDesc" ? "selected" : ""}>${tr("sortHighest")}</option>
            <option value="amountAsc" ${f.sort === "amountAsc" ? "selected" : ""}>${tr("sortLowest")}</option>
          </select>
        </div>

        <div class="between small muted" style="margin:8px 0 12px;">
          <span>${filtered.length} transaction(s) found</span>
          <strong>Total: ${money(totalFilteredAmount)}</strong>
        </div>

        ${pagedExpenses.length ? `
          <div class="list">
            ${pagedExpenses.map(e => expenseRow(e, false, true)).join("")}
          </div>
          ${totalPages > 1 ? `
            <div class="between" style="margin-top:16px;">
              <button class="button sm soft" data-action="ledger-prev-page" ${currentPage <= 1 ? "disabled" : ""}>‹ Previous</button>
              <span class="small muted">Page ${currentPage} of ${totalPages}</span>
              <button class="button sm soft" data-action="ledger-next-page" ${currentPage >= totalPages ? "disabled" : ""}>Next ›</button>
            </div>
          ` : ""}
        ` : `
          <div class="empty">
            <span class="empty-icon">🔎</span>
            <p>${tr("noExpenses")}</p>
          </div>
        `}
      </section>
    ` : `
      <section class="panel">
        <h3>${tr("personalPayments")}</h3>
        <p class="small muted">As household owner, reimburse members for eligible expenses they paid from personal funds. Confirm you have paid them before recording a payment.</p>

        ${personal.length ? personal.map(item => `
          <div class="card" style="margin:12px 0;">
            <div class="between">
              <div>
                <strong>${esc(item.member.name)}</strong>
                <div class="small muted">${money(item.paid)} personal spend · ${money(item.repaid)} repaid</div>
              </div>
              <div class="right">
                <div class="money ${item.outstanding ? "text-warn" : ""}">${money(item.outstanding)}</div>
                <div class="tiny muted">${item.outstanding ? "Outstanding" : "Settled"}</div>
              </div>
            </div>
            ${item.outstanding ? `
              <div style="margin-top:12px;">
                <button class="button primary sm" data-action="settle-dialog" data-user="${esc(item.member.user_id)}" data-amount="${item.outstanding}" data-name="${esc(item.member.name)}">Pay ${money(item.outstanding)} to ${esc(item.member.name)}</button>
              </div>
            ` : ""}
          </div>
        `).join("") : `<div class="empty">${tr("noExpensesByOthers")}</div>`}

        <h3 style="margin-top:24px;">${tr("settlementsHistory")}</h3>
        ${settled.length ? `
          <div class="list">
            ${settled.map(s => `
              <div class="list-row">
                <div class="grow">
                  <strong>${esc(profileName(s.from_user))} → ${esc(profileName(s.to_user))}</strong>
                  <div class="small muted">${dateLabel(s.settled_on)}${s.notes ? ` · ${esc(s.notes)}` : ""}</div>
                </div>
                <div class="right" style="display:flex; align-items:center; gap:8px;">
                  <span class="money">${money(s.amount)}</span>
                  ${isOwner ? `<button class="button sm danger" data-action="reverse-settlement" data-id="${s.id}" title="${tr("reverseSettlement")}">×</button>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty">${tr("noReimbursements")}</div>`}
      </section>
    `}
  `;
}

function expenseRow(expense, small = false, clickable = false) {
  const cat = categoryName(expense.category);
  const rName = roomName(expense.room_id);
  const payer = profileName(expense.paid_by);

  return `
    <div class="list-row ${clickable ? "clickable" : ""}" ${clickable ? `data-action="view-expense" data-id="${expense.id}"` : ""}>
      <div class="avatar" aria-hidden="true">${esc(cat.slice(0, 1))}</div>
      <div class="grow">
        <div class="truncate"><strong>${esc(expense.description)}</strong></div>
        <div class="small muted">
          ${esc(cat)} · ${esc(payer)}${expense.funding === "personal" ? ` · <span class="tag small warn">${tr("personalTag")}</span>` : ""}${rName ? ` · 📍 ${esc(rName)}` : ""}${expense.notes ? ` · 💬` : ""}
        </div>
      </div>
      <div class="right">
        <div class="money">${money(expense.amount)}</div>
        <div class="small muted">${dateLabel(expense.occurred_on)}</div>
      </div>
    </div>
  `;
}

// 3. INSIGHTS VIEW
function alertRows() {
  const alerts = [];
  const thisMonth = monthExpenses();
  const elapsedDays = new Date().getDate();
  const previous = monthExpenses(-1).filter(expense => Number(expense.occurred_on.slice(-2)) <= elapsedDays);

  // Category budget alerts
  for (const budget of state.budgets) {
    const spent = thisMonth.filter(e => e.category === budget.category).reduce((sum, e) => sum + Number(e.amount), 0);
    const limit = Number(budget.monthly_limit);
    if (spent >= limit * 0.8) {
      const supporting = thisMonth.filter(e => e.category === budget.category).slice(0, 3);
      alerts.push({
        level: spent >= limit ? "warn" : "",
        title: tx(spent >= limit ? "budgetExceeded" : "budgetNear", { category: categoryName(budget.category) }),
        detail: tx("budgetDetail", {
          spent: money(spent),
          count: thisMonth.filter(e => e.category === budget.category).length,
          limit: money(limit),
          percent: Math.round(spent / limit * 100)
        }),
        rows: supporting
      });
    }
  }

  // Custom user spending alerts
  for (const alertDef of state.spendingAlerts.filter(a => !a.deleted_at && a.active)) {
    const matchingExpenses = thisMonth.filter(e => !alertDef.category || e.category === alertDef.category);
    const spent = matchingExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    if (spent >= Number(alertDef.threshold_amount)) {
      alerts.push({
        level: "warn",
        title: `Spending Alert: ${alertDef.title}`,
        detail: `Spent ${money(spent)} exceeding threshold of ${money(alertDef.threshold_amount)}.`,
        rows: matchingExpenses.slice(0, 3)
      });
    }
  }

  // Duplicate checks within 14 days
  for (const expense of thisMonth) {
    const earlier = state.expenses.filter(other =>
      !other.deleted_at &&
      other.id !== expense.id &&
      (other.created_at < expense.created_at || (other.created_at === expense.created_at && String(other.id) < String(expense.id))) &&
      other.category === expense.category &&
      Number(other.amount) === Number(expense.amount) &&
      other.description.trim().toLowerCase() === expense.description.trim().toLowerCase() &&
      Math.abs(Date.parse(`${other.occurred_on}T00:00:00`) - Date.parse(`${expense.occurred_on}T00:00:00`)) <= 14 * 86400000
    );
    if (earlier.length) {
      alerts.push({
        level: "warn",
        title: tr("duplicateTitle"),
        detail: tx("duplicateDetail", {
          amount: money(expense.amount), category: categoryName(expense.category),
          description: expense.description, date: dateLabel(expense.occurred_on)
        }),
        rows: [expense, ...earlier.slice(0, 2)]
      });
    }
  }

  // Month-over-month increase checks
  const increases = new Map();
  for (const expense of [...thisMonth, ...previous]) {
    const bucket = increases.get(expense.category) || { current: [], prior: [] };
    (expense.occurred_on >= monthStart() ? bucket.current : bucket.prior).push(expense);
    increases.set(expense.category, bucket);
  }
  for (const [category, bucket] of increases) {
    const current = bucket.current.reduce((sum, e) => sum + Number(e.amount), 0);
    const prior = bucket.prior.reduce((sum, e) => sum + Number(e.amount), 0);
    if (prior >= 1000 && current - prior >= 1000 && current >= prior * 1.3) {
      alerts.push({
        title: tx("increaseTitle", { category: categoryName(category) }),
        detail: tx("increaseDetail", {
          current: money(current), currentCount: bucket.current.length,
          prior: money(prior), priorCount: bucket.prior.length
        }),
        rows: [...bucket.current, ...bucket.prior].slice(0, 4)
      });
    }
  }

  // Unusually large purchase
  for (const expense of thisMonth) {
    const baseline = state.expenses.filter(other =>
      !other.deleted_at &&
      other.category === expense.category &&
      other.id !== expense.id &&
      other.occurred_on < monthStart() &&
      other.occurred_on >= localIsoDate(new Date(Date.now() - 90 * 86400000))
    );
    if (baseline.length < 3) continue;
    const average = baseline.reduce((sum, e) => sum + Number(e.amount), 0) / baseline.length;
    if (Number(expense.amount) >= Math.max(average * 2.5, average + 500)) {
      alerts.push({
        level: "warn",
        title: tx("unusualTitle", { category: categoryName(expense.category) }),
        detail: tx("unusualDetail", {
          amount: money(expense.amount), date: dateLabel(expense.occurred_on),
          average: money(average), count: baseline.length
        }),
        rows: [expense, ...baseline.slice(0, 3)]
      });
    }
  }

  return alerts;
}

function renderInsights() {
  const alerts = alertRows();
  return `
    <header class="top">
      <div>
        <div class="brand-chip">ANALYTICS & INSIGHTS</div>
        <h1 class="hd">${esc(tr("insights"))}</h1>
      </div>
      <button class="button sm soft" data-action="add-spending-alert-dialog">+ Alert</button>
    </header>
    <p class="muted small">${tr("explainAlerts")}</p>

    ${alerts.length ? alerts.map(alert => `
      <article class="card ${alert.level ? "notice warn" : ""}" style="margin:12px 0;">
        <h3 style="margin-bottom:6px;">${esc(alert.title)}</h3>
        <p class="small" style="margin-bottom:12px;">${esc(alert.detail)}</p>
        <div class="list">
          ${alert.rows.map(row => expenseRow(row, true, true)).join("")}
        </div>
      </article>
    `).join("") : `
      <div class="panel empty">
        <span class="empty-icon">✅</span>
        <p>${tr("noAlerts")}</p>
      </div>
    `}
  `;
}

// 4. HOUSEHOLD & SETTINGS VIEW
function renderHousehold() {
  const dark = localStorage.getItem("hearth.theme") === "dark";
  const userMembership = state.members.find(m => m.user_id === state.user.id);
  const isOwner = userMembership?.role === "owner";

  return `
    <header class="top">
      <div>
        <div class="brand-chip">${esc(state.room.name)}</div>
        <h1 class="hd">${esc(tr("household"))}</h1>
      </div>
      <button class="button sm soft" type="button" data-action="toggle-theme">${dark ? tr("lightTheme") : tr("darkTheme")}</button>
    </header>

    <!-- 1. Household Info & Switcher -->
    <section class="panel">
      <div class="between">
        <div>
          <h3>${esc(state.room.name)}</h3>
          <div class="small muted">Invite code: <strong style="letter-spacing:1px; color:var(--accent);">${esc(state.room.invite_code)}</strong></div>
        </div>
        <div class="row">
          <button class="button sm soft" data-action="copy-invite" data-code="${esc(state.room.invite_code)}">Copy code</button>
          ${isOwner ? `<button class="button sm soft" data-action="rename-household-dialog">${tr("edit")}</button>` : ""}
        </div>
      </div>

      <div style="margin-top:16px;">
        <h4>${tr("switchRoom")}</h4>
        <div class="row" style="flex-wrap:wrap; margin-top:8px;">
          ${state.households.map(h => `
            <button class="button sm ${h.id === state.room.id ? "primary" : "soft"}" data-action="switch-room" data-id="${h.id}">
              ${esc(h.name)} ${h.id === state.room.id ? "✓" : ""}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="grid-two" style="margin-top:16px;">
        <button class="button sm" data-action="create-household-dialog">＋ ${tr("createAnotherRoom")}</button>
        <button class="button sm" data-action="join-household-dialog">🔗 ${tr("joinAnotherRoom")}</button>
      </div>
    </section>

    <!-- 2. Household Members Management -->
    <section class="panel">
      <div class="between">
        <div>
          <h3>${tr("membersTitle")}</h3>
          <div class="small muted">👥 <strong>${formatPeopleInHouse(state.members.length)}</strong></div>
        </div>
        <button class="button sm soft" data-action="copy-invite" data-code="${esc(state.room.invite_code)}">+ Invite</button>
      </div>

      <div class="list" style="margin-top:8px;">
        ${state.members.map(m => `
          <div class="list-row">
            <div class="avatar" style="width:34px; height:34px; font-size:13px;">${esc((m.name || "U")[0].toUpperCase())}</div>
            <div class="grow">
              <strong>${esc(m.name)}${m.user_id === state.user.id ? " (You)" : ""}</strong>
              <div class="tiny muted">${m.role === "owner" ? `<span class="tag small">${tr("roleOwner")}</span>` : `<span class="tag small neutral">${tr("roleMember")}</span>`}</div>
            </div>
            ${isOwner && m.user_id !== state.user.id ? `
              <div class="row">
                <button class="button sm soft" data-action="toggle-member-role" data-user="${m.user_id}" data-role="${m.role === "owner" ? "member" : "owner"}">
                  ${m.role === "owner" ? tr("makeMember") : tr("makeOwner")}
                </button>
                <button class="button sm danger" data-action="remove-member-dialog" data-user="${m.user_id}" data-name="${esc(m.name)}">Remove</button>
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>

      <div style="margin-top:14px; text-align:right;">
        <button class="button sm danger" data-action="leave-household-dialog">${tr("leaveHousehold")}</button>
        ${isOwner ? `<button class="button sm danger" style="margin-left:8px;" data-action="delete-household-dialog">${tr("deleteHousehold")}</button>` : ""}
      </div>
    </section>

    <!-- 3. Rooms & Spaces Management -->
    <section class="panel">
      <div class="between">
        <div>
          <h3>${tr("rooms")}</h3>
          <div class="small muted">${state.rooms.filter(r => !r.deleted_at).length} spaces configured</div>
        </div>
        <button class="button sm soft" data-action="add-room-dialog">+ ${tr("addRoom")}</button>
      </div>
      <p class="small muted">Tag expenses with specific rooms to track house maintenance and areas.</p>

      ${state.rooms.filter(r => !r.deleted_at).length ? `
        <div class="list">
          ${state.rooms.filter(r => !r.deleted_at).map(r => {
            const roomExpenses = state.expenses.filter(e => !e.deleted_at && e.room_id === r.id);
            const expCount = roomExpenses.length;
            const peopleInRoom = new Set(roomExpenses.map(e => e.paid_by)).size;
            const spent = roomExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
            return `
              <div class="list-row">
                <div class="avatar room-icon" style="width:34px; height:34px; font-size:13px;">📍</div>
                <div class="grow">
                  <strong>${esc(r.name)}</strong>
                  <div class="small muted">👥 ${formatPeopleInRoom(peopleInRoom)} · ${expCount} expense(s) · ${money(spent)} spent</div>
                </div>
                <div class="row">
                  <button class="button sm soft" data-action="edit-room-dialog" data-id="${r.id}" data-name="${esc(r.name)}">${tr("edit")}</button>
                  <button class="button sm danger" data-action="delete-room-dialog" data-id="${r.id}" data-name="${esc(r.name)}">×</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : `<div class="empty small">${tr("noExpenses")} Add living room, kitchen, etc.</div>`}
    </section>

    <!-- 4. Category Budgets -->
    <section class="panel">
      <div class="between">
        <h3>${tr("monthlyBudget")}</h3>
        <button class="button sm soft" data-action="add-budget-dialog">+ Budget</button>
      </div>
      <p class="small muted">Set monthly targets per category.</p>

      ${state.budgets.length ? `
        <div class="list">
          ${state.budgets.map(b => `
            <div class="list-row">
              <div class="grow">
                <strong>${esc(categoryName(b.category))}</strong>
                <div class="small muted">Limit: ${money(b.monthly_limit)} / month</div>
              </div>
              <div class="row">
                <button class="button sm danger" data-action="delete-budget" data-id="${b.id}">×</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty small">${tr("budgetNotSet")}</div>`}
    </section>

    <!-- 5. User Profile & Language -->
    <section class="panel">
      <h3>${tr("settings")}</h3>
      <form data-form="profile">
        <label class="field-label">${tr("name")}<input class="field" name="display_name" maxlength="80" value="${esc(state.profile.display_name)}"></label>
        <label class="field-label">${tr("language")}<select class="field" name="language">
          <option value="en" ${state.profile.language === "en" ? "selected" : ""}>English</option>
          <option value="ta" ${state.profile.language === "ta" ? "selected" : ""}>தமிழ்</option>
        </select></label>
        <button class="button primary" style="margin-top:12px;">${tr("save")}</button>
      </form>
    </section>

    <section class="panel">
      <h3>${tr("appUpdates")}</h3>
      <p class="small muted">${tx("installedVersion", { version: CURRENT_APP_VERSION })}</p>
      <p class="small muted">${tr("updateHelp")}</p>
      <button class="button soft" type="button" data-action="check-app-update">${tr("checkUpdates")}</button>
    </section>

    <div style="margin-top:16px;">
      <button class="button danger" style="width:100%;" data-action="signout">${tr("signOut")}</button>
    </div>
  `;
}

// 5. MORE DESTINATIONS VIEW
function renderMore() {
  const destinations = [
    ["calendar", "🗓️", tr("calendar"), tr("calendarSubtitle")],
    ["groceries", "🛒", tr("groceries"), `${state.shopping.filter(i => !i.deleted_at && !i.purchased).length} pending items`],
    ["bills", "🗓", tr("bills"), `${state.bills.filter(b => !b.deleted_at && b.active).length} scheduled`],
    ["goals", "🎯", tr("goals"), `${state.goals.filter(g => !g.deleted_at).length} active goals`],
    ["reports", "📊", tr("reports"), "Monthly totals, CSV, print"]
  ];

  return `
    <header class="top">
      <div>
        <div class="brand-chip">${esc(state.room.name)}</div>
        <h1 class="hd">${esc(tr("voiceMoreTitle"))}</h1>
      </div>
    </header>
    <p class="muted small">${tr("voiceMoreIntro")}</p>

    <section class="panel more-menu" aria-label="${tr("voiceMoreTitle")}">
      ${destinations.map(([page, icon, label, subtitle]) => `
        <button class="more-link" type="button" data-action="navigate" data-value="${page}">
          <span class="more-icon" aria-hidden="true">${icon}</span>
          <div class="grow">
            <div>${esc(label)}</div>
            <div class="tiny muted">${esc(subtitle)}</div>
          </div>
          <span aria-hidden="true">›</span>
        </button>
      `).join("")}
      <button class="more-link" type="button" data-action="navigate" data-value="household">
        <span class="more-icon" aria-hidden="true">⚙</span>
        <div class="grow">
          <div>${tr("household")} & ${tr("settings")}</div>
          <div class="tiny muted">Rooms, members, preferences</div>
        </div>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  `;
}

function renderCalendar() {
  const minMonth = monthStart(-11).slice(0, 7);
  const maxMonth = monthStart().slice(0, 7);
  let currentMonth = typeof state.calendarMonth === "string" ? state.calendarMonth.trim() : "";
  if (currentMonth.length > 7 && /^\d{4}-(0[1-9]|1[0-2])/.test(currentMonth)) {
    currentMonth = currentMonth.slice(0, 7);
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(currentMonth) || currentMonth < minMonth || currentMonth > maxMonth) {
    currentMonth = maxMonth;
    state.calendarSelectedDate = "";
  }
  state.calendarMonth = currentMonth;
  return renderExpenseCalendar({
    expenses: state.expenses || [],
    month: state.calendarMonth,
    locale: locale(),
    selectedDate: state.calendarSelectedDate,
    minMonth,
    maxMonth
  });
}

// 6. GROCERIES / SHOPPING LIST
function renderGroceries() {
  const pending = state.shopping.filter(item => !item.deleted_at && !item.purchased);
  const purchased = state.shopping.filter(item => !item.deleted_at && item.purchased);
  const estimate = pending.reduce((sum, item) => sum + (Number(item.estimated_unit_price || 0) * Number(item.quantity)), 0);

  return `
    <header class="top">
      <div>
        <div class="brand-chip">SHARED GROCERY LIST</div>
        <h1 class="hd">${esc(tr("groceries"))}</h1>
      </div>
      ${purchased.length ? `<button class="button sm danger" data-action="clear-completed-shopping">${tr("clearCompleted")}</button>` : ""}
    </header>

    <section class="panel">
      <form data-form="shopping-add" class="form-grid">
        <label class="field-label" style="grid-column:1/-1;">Item<input class="field" name="name" maxlength="100" placeholder="e.g. Rice, Apples" required></label>
        <label class="field-label">${tr("quantity")}<input class="field" name="quantity" type="number" min="0.01" step="0.01" value="1" required></label>
        <label class="field-label">${tr("unit")}<input class="field" name="unit" maxlength="30" placeholder="kg, pack, l"></label>
        <label class="field-label" style="grid-column:1/-1;">${tr("estimatedPrice")} (₹)<input class="field" name="price" type="number" min="0" step="0.01" placeholder="Optional estimated cost"></label>
        <button class="button primary" style="grid-column:1/-1;">${tr("groceryAdd")}</button>
      </form>
    </section>

    <div class="between small muted" style="margin:16px 4px 6px;">
      <span>${pending.length} to buy · Est: ${money(estimate)}</span>
    </div>

    ${pending.length ? `
      <section class="panel" style="margin-top:0;">
        <div class="list">
          ${pending.map(item => `
            <div class="list-row">
              <input class="check" type="checkbox" aria-label="${tr("purchased")}" data-action="purchased" data-id="${item.id}">
              <div class="grow">
                <strong>${esc(item.name)}</strong>
                <div class="small muted">${Number(item.quantity)} ${esc(item.unit)} ${item.estimated_unit_price != null ? `· ${money(item.estimated_unit_price)} each` : ""}</div>
              </div>
              <div class="row">
                <button class="button sm soft" data-action="convert-grocery" data-id="${item.id}">${tr("convert")}</button>
                <button class="button sm danger" data-action="delete-shopping-item" data-id="${item.id}">×</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    ` : `<div class="panel empty">${tr("noItems")}</div>`}

    ${purchased.length ? `
      <section class="panel">
        <h3>${tr("purchased")} (${purchased.length})</h3>
        <div class="list">
          ${purchased.map(item => `
            <div class="list-row">
              <input class="check" type="checkbox" checked aria-label="${tr("purchased")}" data-action="unpurchase" data-id="${item.id}">
              <div class="grow">
                <strong style="text-decoration:line-through; opacity:0.75;">${esc(item.name)}</strong>
                <div class="small muted">${Number(item.quantity)} ${esc(item.unit)} · ${item.expense_id ? tr("recorded") : tr("readyRecord")}</div>
              </div>
              <div class="row">
                ${!item.expense_id ? `<button class="button sm primary" data-action="convert-grocery" data-id="${item.id}">${tr("convert")}</button>` : `<span class="tag small success">✓ Recorded</span>`}
                <button class="button sm danger" data-action="delete-shopping-item" data-id="${item.id}">×</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `;
}

// 7. RECURRING BILLS VIEW
function renderBills() {
  const activeBills = state.bills.filter(b => !b.deleted_at);
  const sorted = [...activeBills].sort((a, b) => a.next_due.localeCompare(b.next_due));

  return `
    <header class="top">
      <div>
        <div class="brand-chip">SCHEDULED EXPENSES</div>
        <h1 class="hd">${esc(tr("bills"))}</h1>
      </div>
      <button class="button sm soft" data-action="bill-add">＋ ${tr("recurring")}</button>
    </header>
    <p class="muted small">${tr("reminders")}</p>

    ${sorted.length ? `
      <div class="list" style="border:0;">
        ${sorted.map(bill => {
          const isDue = bill.next_due <= today();
          const cadence = ({ weekly: tr("cadenceWeekly"), monthly: tr("cadenceMonthly"), yearly: tr("cadenceYearly") })[bill.cadence] || bill.cadence;
          return `
            <section class="panel" style="margin:10px 0;">
              <div class="between">
                <div>
                  <h3 style="${!bill.active ? "opacity:0.6;" : ""}">${esc(bill.title)}</h3>
                  <div class="small muted">${esc(categoryName(bill.category))} · ${esc(cadence)}${!bill.active ? ` · <span class="tag small neutral">${tr("paused")}</span>` : ""}</div>
                </div>
                <div class="right">
                  <div class="money">${money(bill.amount)}</div>
                  <div class="small ${isDue ? "tag warn small" : "muted"}">${tr("nextDue")}: ${dateLabel(bill.next_due)}</div>
                </div>
              </div>

              <div class="between" style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line);">
                <div class="row">
                  <button class="button sm soft" data-action="edit-bill-dialog" data-id="${bill.id}">${tr("edit")}</button>
                  <button class="button sm soft" data-action="toggle-bill-active" data-id="${bill.id}">${bill.active ? tr("pauseBill") : tr("resumeBill")}</button>
                  <button class="button sm danger" data-action="delete-bill" data-id="${bill.id}">×</button>
                </div>
                ${bill.active && isDue ? `<button class="button sm primary" data-action="confirm-bill" data-id="${bill.id}">${tr("confirmPaid")}</button>` : ""}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    ` : `<div class="panel empty">${tr("noBills")}</div>`}
  `;
}

// 8. SAVINGS GOALS VIEW
function renderGoals() {
  const activeGoals = state.goals.filter(g => !g.deleted_at);

  return `
    <header class="top">
      <div>
        <div class="brand-chip">SAVINGS TARGETS</div>
        <h1 class="hd">${esc(tr("goals"))}</h1>
      </div>
      <button class="button sm soft" data-action="goal-add">＋ ${tr("goalAdd")}</button>
    </header>
    <p class="muted small">Contributions are tracked towards targets separately from daily spending.</p>

    ${activeGoals.length ? activeGoals.map(goal => {
      const contributions = state.contributions.filter(c => !c.deleted_at && c.goal_id === goal.id);
      const totalSaved = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
      const pct = Math.min(100, Math.round((totalSaved / Number(goal.target_amount)) * 100));

      return `
        <section class="panel">
          <div class="between">
            <div>
              <h3>${esc(goal.title)}</h3>
              <div class="small muted">${goal.deadline ? `${tr("due")} ${dateLabel(goal.deadline)}` : tr("noDeadline")}</div>
            </div>
            <div class="row">
              <button class="button sm soft" data-action="contribute" data-id="${goal.id}">${tr("contribute")}</button>
              <button class="button sm soft" data-action="edit-goal-dialog" data-id="${goal.id}">${tr("edit")}</button>
              <button class="button sm danger" data-action="delete-goal" data-id="${goal.id}">×</button>
            </div>
          </div>

          <div class="between small" style="margin-top:14px;">
            <span><strong>${money(totalSaved)}</strong> ${tr("saved")}</span>
            <span class="muted">Target: ${money(goal.target_amount)} (${pct}%)</span>
          </div>
          <div class="progress"><i style="width:${pct}%;"></i></div>
        </section>
      `;
    }).join("") : `<div class="panel empty">${tr("noGoals")}</div>`}
  `;
}

// 9. REPORTS & AUDIT VIEW
function renderReports() {
  const expenses = state.expenses.filter(e => !e.deleted_at).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  return `
    <header class="top">
      <div>
        <div class="brand-chip">EXPORT & AUDIT</div>
        <h1 class="hd">${esc(tr("reports"))}</h1>
      </div>
    </header>

    <div class="grid-two no-print" style="margin-bottom:14px;">
      <button class="button" data-action="csv">📥 ${tr("exportCsv")}</button>
      <button class="button" data-action="pdf">🖨 ${tr("printPdf")}</button>
    </div>

    <div class="print-only">
      <h2>${esc(state.room.name)} — ${tr("reports")}</h2>
      <p>${tr("generated")} ${dateLabel(today())}</p>
    </div>

    <section class="panel">
      <h3>${tr("monthSummary")}</h3>
      ${[0, -1, -2, -3, -4, -5].map(shift => {
        const rows = monthExpenses(shift);
        return `
          <div class="between list-row">
            <span>${esc(new Date(`${monthStart(shift)}T00:00:00`).toLocaleDateString(locale(), { month: "long", year: "numeric" }))} (${rows.length} entries)</span>
            <strong>${money(rows.reduce((sum, e) => sum + Number(e.amount), 0))}</strong>
          </div>
        `;
      }).join("")}
    </section>

    <section class="panel">
      <h3>${tr("audit")}</h3>
      ${state.activity.length ? `
        <div class="list">
          ${state.activity.slice(0, 40).map(event => `
            <div class="list-row">
              <div class="grow">
                <strong>${esc(event.action.toUpperCase())} ${esc(event.entity.replaceAll("_", " "))}</strong>
                <div class="small muted">${esc(profileName(event.actor_id || ""))} · ${new Date(event.created_at).toLocaleString(locale())}</div>
                <details class="small" style="margin-top:4px;">
                  <summary class="muted">${tr("changeDetails")}</summary>
                  <pre class="audit-json">${esc(JSON.stringify(event.details, null, 2))}</pre>
                </details>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty">${tr("noAudit")}</div>`}
    </section>
  `;
}

function render() {
  document.documentElement.lang = state.profile?.language === "ta" ? "ta" : "en";
  document.documentElement.dataset.theme = localStorage.getItem("hearth.theme") === "dark" ? "dark" : "light";

  if (!state.client) return;
  if (!state.user) return renderAuth();
  if (!state.room) return renderOnboarding();
  if (!state.profile) {
    app.innerHTML = `<section class="panel">${tr("loading")}</section>`;
    return;
  }

  const views = {
    home: renderHome,
    insights: renderInsights,
    ledger: renderLedger,
    groceries: renderGroceries,
    bills: renderBills,
    goals: renderGoals,
    reports: renderReports,
    calendar: renderCalendar,
    household: renderHousehold,
    settings: renderHousehold,
    more: renderMore
  };

  const renderer = views[state.page] || renderHome;
  let viewHtml = "";
  try {
    viewHtml = renderer();
  } catch (error) {
    console.error(`Render failure on page "${state.page}":`, error);
    viewHtml = `
      <section class="panel">
        <h2 class="hd" style="color:var(--danger, #b91c1c);">Unable to open this view</h2>
        <p class="muted">${esc(error.message || "An unexpected error occurred.")}</p>
        <button class="button soft" type="button" data-action="navigate" data-value="home">Return to Home</button>
      </section>
    `;
  }

  app.innerHTML = `${viewHtml}${renderNav()}`;
}

// DATA INITIALIZATION & REFRESH
async function loadHouseholds() {
  const { data: memberships, error } = await state.client.from("household_members")
    .select("household_id,role").eq("user_id", state.user.id);
  if (error) throw error;
  if (!memberships.length) {
    state.households = [];
    state.room = null;
    return;
  }

  const { data: rooms, error: roomError } = await state.client.from("households")
    .select("id,name,invite_code").in("id", memberships.map(m => m.household_id)).order("created_at");
  if (roomError) throw roomError;

  state.households = rooms || [];
  state.room = state.households.find(room => room.id === localStorage.getItem("hearth.room")) || state.households[0] || null;
}

async function refreshRoom() {
  if (!state.room) return;
  const roomId = state.room.id;

  const { data: members, error: membersError } = await state.client.from("household_members")
    .select("user_id,role").eq("household_id", roomId);
  if (membersError) throw membersError;

  const queries = await Promise.allSettled([
    fetchAllRows(state.client.from("expenses").select("*").eq("household_id", roomId).order("occurred_on", { ascending: false })),
    state.client.from("category_budgets").select("*").eq("household_id", roomId),
    state.client.from("recurring_bills").select("*").eq("household_id", roomId).order("next_due"),
    state.client.from("shopping_items").select("*").eq("household_id", roomId).order("created_at", { ascending: false }),
    state.client.from("savings_goals").select("*").eq("household_id", roomId).order("created_at", { ascending: false }),
    state.client.from("savings_contributions").select("*").eq("household_id", roomId).order("contributed_on", { ascending: false }),
    fetchAllRows(state.client.from("settlements").select("*").eq("household_id", roomId).order("settled_on", { ascending: false })),
    state.client.from("activity_events").select("*").eq("household_id", roomId).order("created_at", { ascending: false }).limit(60),
    state.client.from("user_profiles").select("user_id,display_name").in("user_id", members.map(m => m.user_id)),
    // Optional schema enhancements (graceful fallback if migration not yet run)
    state.client.from("rooms").select("*").eq("household_id", roomId).order("created_at"),
    state.client.from("custom_categories").select("*").eq("household_id", roomId),
    state.client.from("payment_methods").select("*").eq("household_id", roomId),
    state.client.from("spending_alerts").select("*").eq("household_id", roomId)
  ]);

  const [expRes, budRes, billRes, shopRes, goalRes, contRes, settRes, actRes, profRes, roomsRes, custCatRes, payMethRes, alertRes] = queries;

  const expenses = queryRows(expRes, "expenses");
  const budgets = queryRows(budRes, "budgets");
  const bills = queryRows(billRes, "recurring bills");
  const shopping = queryRows(shopRes, "shopping items");
  const goals = queryRows(goalRes, "savings goals");
  const contributions = queryRows(contRes, "savings contributions");
  const settlements = queryRows(settRes, "settlements");
  const activity = queryRows(actRes, "activity events");
  const profiles = queryRows(profRes, "member profiles");
  const rooms = queryRows(roomsRes, "rooms", true);
  const customCategories = queryRows(custCatRes, "custom categories", true);
  const paymentMethods = queryRows(payMethRes, "payment methods", true);
  const spendingAlerts = queryRows(alertRes, "spending alerts", true);

  if (state.room?.id !== roomId) return;

  state.expenses = expenses;
  state.budgets = budgets;
  state.bills = bills;
  state.shopping = shopping;
  state.goals = goals;
  state.contributions = contributions;
  state.settlements = settlements;
  state.activity = activity;

  const names = new Map(profiles.map(p => [p.user_id, p.display_name]));
  state.members = members.map(m => ({
    ...m,
    name: names.get(m.user_id) || (m.user_id === state.user.id ? state.profile.display_name : "") || `${m.user_id.slice(0, 6)}…`
  }));

  // Enhanced features
  state.rooms = rooms;
  state.customCategories = customCategories;
  state.paymentMethods = paymentMethods;
  state.spendingAlerts = spendingAlerts;

  render();
}

async function fetchAllRows(query, pageSize = 1000) {
  const allRows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < pageSize) return allRows;
  }
}

async function bootstrap() {
  state.loading = true;
  const { data: { user } } = await state.client.auth.getUser();
  state.user = user;
  if (!user) {
    state.subscription?.unsubscribe();
    state.subscription = null;
    state.profile = null;
    state.room = null;
    state.loading = false;
    render();
    return;
  }

  const metadataName = user.user_metadata?.display_name || user.email?.split("@")[0] || "";
  const { data: existingProfile, error: readProfileError } = await state.client.from("user_profiles")
    .select("user_id,display_name,language").eq("user_id", user.id).maybeSingle();
  if (readProfileError) throw readProfileError;

  if (existingProfile) state.profile = existingProfile;
  else {
    const { data: createdProfile, error: createProfileError } = await state.client.from("user_profiles")
      .insert({ user_id: user.id, display_name: metadataName }).select("user_id,display_name,language").single();
    if (createProfileError) throw createProfileError;
    state.profile = createdProfile;
  }

  await loadHouseholds();
  state.loading = false;
  if (state.room) {
    localStorage.setItem("hearth.room", state.room.id);
    await refreshRoom();
    subscribeRealtime();
  } else {
    render();
  }
}

function subscribeRealtime() {
  state.subscription?.unsubscribe();
  if (!state.room) return;

  const roomId = state.room.id;
  const channel = state.client.channel(`hearth:${roomId}`);
  const householdTables = [
    "expenses", "category_budgets", "recurring_bills", "shopping_items",
    "savings_goals", "savings_contributions", "settlements", "activity_events",
    "household_members", "rooms", "custom_categories", "payment_methods",
    "spending_alerts"
  ];
  const queueRefresh = reloadHouseholds => {
    clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = setTimeout(async () => {
      if (state.room?.id !== roomId) return;
      try {
        if (reloadHouseholds) {
          await loadHouseholds();
          if (state.room?.id !== roomId) {
            subscribeRealtime();
            if (!state.room) render();
          }
        }
        await refreshRoom();
      } catch (error) {
        showError(error);
      }
    }, 150);
  };

  for (const table of householdTables) {
    channel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table,
      filter: `household_id=eq.${roomId}`
    }, payload => {
      queueRefresh(table === "household_members" || (table === "activity_events" && payload.new?.entity === "household_members"));
    });
  }

  channel.on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "households",
    filter: `id=eq.${roomId}`
  }, () => queueRefresh(true));

  state.subscription = channel.subscribe((status, error) => {
    if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      console.error(`Household live updates ${status.toLowerCase()}.`, error || "");
    }
  });
}

// MODAL CONTROLLER
function modal(title, contents, { onOpen } = {}) {
  modalRoot.innerHTML = `
    <div class="sheet-backdrop" data-action="dismiss">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-head">
          <h2 style="margin:0; font-size:20px;">${esc(title)}</h2>
          <button class="button sm" type="button" data-action="close">${tr("close")}</button>
        </div>
        <div class="sheet-content">${contents}</div>
      </section>
    </div>
  `;
  onOpen?.();
}

function closeModal() {
  if (state.receiptUrl) URL.revokeObjectURL(state.receiptUrl);
  state.receiptUrl = null;
  disposeVoiceSession(state.voice);
  state.listening = null;
  state.voice = null;
  modalRoot.innerHTML = "";
}

function confirmDestructive({ title, message, details = "", confirmLabel = tr("delete"), onConfirm }) {
  modal(title, `
    <p><strong>${esc(message)}</strong></p>
    ${details ? `<p class="small muted">${esc(details)}</p>` : ""}
    <div class="grid-two" style="margin-top:20px;">
      <button class="button" type="button" data-action="close">${tr("cancel")}</button>
      <button class="button danger" type="button" id="confirm-destructive-btn">${esc(confirmLabel)}</button>
    </div>
  `, {
    onOpen: () => {
      document.querySelector("#confirm-destructive-btn")?.addEventListener("click", async () => {
        closeModal();
        try {
          await onConfirm();
        } catch (err) {
          showError(err);
        }
      });
    }
  });
}

// TRANSACTION FORM (ADD / EDIT)
function expenseForm({
  id = "",
  amount = "",
  category = "veg",
  description = "",
  occurred = today(),
  fingerprint = "",
  voiceMessage = "",
  paid_by = state.user?.id,
  funding = "shared",
  room_id = "",
  payment_method = "cash",
  notes = ""
} = {}) {
  const isEdit = Boolean(id);
  const contents = `
    <form data-form="expense" data-id="${esc(id)}" data-fingerprint="${esc(fingerprint)}">
      <div class="form-grid">
        <label class="field-label ${voiceMessage ? "voice-amount-field" : ""}">${tr("amount")} (₹)
          <input class="field ${voiceMessage ? "voice-amount-input" : ""}" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(amount)}" required>
        </label>
        <label class="field-label">${tr("date")}
          <input class="field" name="occurred_on" type="date" value="${esc(occurred)}" max="${today()}" required>
        </label>
        <label class="field-label">${tr("category")}
          <select class="field" name="category" required>
            ${allCategoriesList().map(([cid]) => `<option value="${cid}" ${cid === category ? "selected" : ""}>${esc(categoryName(cid))}</option>`).join("")}
          </select>
        </label>
        <label class="field-label">${tr("paidBy")}${memberSelect(paid_by)}</label>
      </div>

      <label class="field-label">${tr("description")}
        <input class="field" name="description" maxlength="120" value="${esc(description)}" placeholder="e.g. Weekly vegetable haul" required>
      </label>

      <div class="form-grid">
        <label class="field-label">${tr("funding")}
          <select class="field" name="funding" required>
            <option value="shared" ${funding === "shared" ? "selected" : ""}>${tr("shared")}</option>
            <option value="personal" ${funding === "personal" ? "selected" : ""}>${tr("personal")}</option>
          </select>
        </label>
        <label class="field-label">${tr("rooms")}${roomSelect(room_id)}</label>
      </div>

      <div class="form-grid">
        <label class="field-label">${tr("paymentMethod")}${paymentMethodSelect(payment_method)}</label>
        <label class="field-label">${tr("notes")}
          <input class="field" name="notes" maxlength="150" value="${esc(notes)}" placeholder="Optional note">
        </label>
      </div>

      <div class="notice ${voiceMessage ? "" : "hidden"}" data-voice-notice>${esc(voiceMessage)}</div>
      <div class="notice warn hidden" data-duplicate></div>
      <div data-receipt-slot></div>

      <button type="submit" class="button primary">${isEdit ? tr("save") : tr("save")}</button>
    </form>
  `;

  modal(isEdit ? tr("editExpense") : tr("addExpense"), `
    ${!isEdit ? `
      <div class="between no-print" style="margin-bottom:12px;">
        <button class="button soft sm" type="button" data-action="voice">🎙 ${tr("voice")}</button>
        <label class="button soft sm" style="cursor:pointer;">📷 ${tr("receipt")}<input hidden type="file" accept="image/*" capture="environment" data-action="receipt"></label>
      </div>
    ` : ""}
    ${contents}
  `, {
    onOpen: () => {
      const form = modalRoot.querySelector('[data-form="expense"]');
      form.querySelector('[name="description"]')?.addEventListener("input", inspectDuplicate);
      form.querySelector('[name="amount"]')?.addEventListener("input", inspectDuplicate);
      form.querySelector('[name="occurred_on"]')?.addEventListener("change", inspectDuplicate);
    }
  });
}

function inspectDuplicate() {
  const form = modalRoot.querySelector('[data-form="expense"]');
  if (!form) return;
  const currentId = form.dataset.id;
  const amount = Number(form.elements.amount.value);
  const description = form.elements.description.value.trim().toLowerCase();
  const date = form.elements.occurred_on.value;

  const duplicate = state.expenses.find(e =>
    !e.deleted_at &&
    e.id !== currentId &&
    Number(e.amount) === amount &&
    e.description.trim().toLowerCase() === description &&
    e.occurred_on === date
  );

  const notice = form.querySelector("[data-duplicate]");
  if (duplicate) {
    notice.classList.remove("hidden");
    notice.textContent = `${tr("duplicate")}: ${money(duplicate.amount)} · ${esc(duplicate.description)} on ${dateLabel(duplicate.occurred_on)}.`;
  } else {
    notice.classList.add("hidden");
    notice.textContent = "";
  }
}

// TRANSACTION DETAILS MODAL
function viewExpenseDetails(expenseId) {
  const expense = state.expenses.find(e => e.id === expenseId);
  if (!expense) return;

  const cat = categoryName(expense.category);
  const payer = profileName(expense.paid_by);
  const rName = roomName(expense.room_id) || "None (General)";
  const method = paymentMethodName(expense.payment_method);

  modal(tr("expenseDetails"), `
    <div style="text-align:center; padding:10px 0 16px;">
      <div class="avatar" style="width:52px; height:52px; font-size:22px; margin:0 auto 10px;">${esc(cat.slice(0, 1))}</div>
      <div class="amount" style="color:var(--ink); margin:0;">${money(expense.amount)}</div>
      <div style="font-size:18px; font-weight:700; margin-top:4px;">${esc(expense.description)}</div>
      <div class="small muted">${dateLabel(expense.occurred_on)}</div>
    </div>

    <div class="panel" style="margin:10px 0;">
      <div class="between list-row"><span class="muted">${tr("category")}</span><strong>${esc(cat)}</strong></div>
      <div class="between list-row"><span class="muted">${tr("paidBy")}</span><strong>${esc(payer)}</strong></div>
      <div class="between list-row"><span class="muted">${tr("funding")}</span><span class="tag ${expense.funding === "personal" ? "warn" : ""}">${esc(expense.funding === "personal" ? tr("personal") : tr("shared"))}</span></div>
      <div class="between list-row"><span class="muted">${tr("rooms")}</span><strong>📍 ${esc(rName)}</strong></div>
      <div class="between list-row"><span class="muted">${tr("paymentMethod")}</span><strong>💳 ${esc(method)}</strong></div>
      ${expense.notes ? `<div class="between list-row"><span class="muted">${tr("notes")}</span><span style="max-width:65%; text-align:right;">${esc(expense.notes)}</span></div>` : ""}
      ${expense.receipt_fingerprint ? `<div class="between list-row"><span class="muted">Receipt</span><span class="tag small success">Scanned receipt attached</span></div>` : ""}
    </div>

    <div class="grid-two" style="margin-top:16px;">
      <button class="button soft" data-action="edit-expense" data-id="${expense.id}">${tr("edit")}</button>
      <button class="button danger" data-action="delete-expense" data-id="${expense.id}">${tr("delete")}</button>
    </div>
  `);
}

// RECEIPT SCAN
async function scanReceipt(file) {
  if (!file) return;
  if (state.receiptUrl) URL.revokeObjectURL(state.receiptUrl);
  state.receiptUrl = URL.createObjectURL(file);

  const slot = modalRoot.querySelector("[data-receipt-slot]");
  if (slot) {
    slot.innerHTML = `<div class="notice">Reading receipt in browser… verify extracted fields.</div><img class="receipt-preview" src="${state.receiptUrl}" alt="Selected receipt">`;
  }

  try {
    const { createWorker } = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
    const worker = await createWorker(state.profile.language === "ta" ? "tam+eng" : "eng");
    let data;
    try {
      ({ data } = await worker.recognize(file));
    } finally {
      await worker.terminate();
    }

    const parsed = parseReceiptText(data.text);
    const fingerprint = await digestFile(file);
    expenseForm({ ...parsed, fingerprint });

    const form = modalRoot.querySelector('[data-form="expense"]');
    if (form) {
      form.querySelector("[data-receipt-slot]").innerHTML = `<div class="notice">${esc(data.text.trim().slice(0, 500) || "Review details.")}<br><span class="small">OCR extracted text locally on your device.</span></div><img class="receipt-preview" src="${state.receiptUrl}" alt="Receipt">`;
      inspectDuplicate();
    }
  } catch (error) {
    showError(new Error(`Receipt OCR error: ${errorMessage(error)}. You can enter details manually.`));
  }
}

function parseReceiptText(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totalLines = lines.filter(line => /\b(grand\s*total|total\s*due|amount\s*paid|net\s*total|total)\b/i.test(line));
  const getAmounts = line => {
    const withoutDates = line.replace(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/g, " ");
    return [...withoutDates.matchAll(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
      .map(match => Number(match[1].replaceAll(",", ""))).filter(value => value > 0 && value < 10000000);
  };
  const labelledAmounts = totalLines.flatMap(getAmounts);
  const currencyAmounts = lines.flatMap(getAmounts);
  const amount = (labelledAmounts.at(-1) ?? currencyAmounts.at(-1) ?? "").toString();
  const description = (lines.find(line => /[a-zA-Z]{3}/.test(line)) || "").slice(0, 120);
  const dateMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b|\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  let occurred = today();
  if (dateMatch) {
    const ymd = dateMatch[1] ? [dateMatch[1], dateMatch[2], dateMatch[3]] : [dateMatch[6], dateMatch[5], dateMatch[4]];
    const iso = `${ymd[0]}-${String(ymd[1]).padStart(2, "0")}-${String(ymd[2]).padStart(2, "0")}`;
    if (iso <= today() && !Number.isNaN(Date.parse(`${iso}T00:00:00`))) occurred = iso;
  }
  return { amount, description, occurred };
}

async function digestFile(file) {
  if (!globalThis.crypto?.subtle) return "";
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}

// VOICE ENTRY WORKFLOW (100% PRESERVED & ENHANCED)
function openVoiceEntry() {
  closeModal();
  const secure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const session = {
    id: ++voiceSequence,
    language: state.profile?.language === "ta" ? "ta" : "en",
    status: "idle",
    transcript: "",
    draft: null,
    error: !secure ? tr("voiceSecure") : "",
    blob: null,
    recorder: null,
    stream: null,
    chunks: [],
    upload: null,
    timer: null,
    startedAt: 0,
    durationSeconds: 0,
    consent: false,
    uploadPercent: null
  };
  if (!secure) session.status = "error";
  state.voice = session;

  modal(tr("voiceTitle"), `
    <div class="voice-panel" data-voice-panel>
      <label class="field-label">${tr("voiceLanguage")}
        <select class="field" data-voice-language>
          <option value="en" ${session.language === "en" ? "selected" : ""}>English</option>
          <option value="ta" ${session.language === "ta" ? "selected" : ""}>தமிழ்</option>
        </select>
      </label>
      <div class="voice-stage">
        <div class="voice-wave" data-voice-wave aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <button class="mic-button" type="button" data-action="voice-start" aria-label="${tr("voiceStart")}">🎙</button>
        <p class="voice-status" data-voice-status role="status" aria-live="polite"></p>
        <div class="voice-timer" data-voice-timer>00:00 / 01:00</div>
      </div>
      <section class="voice-transcript">
        <div class="small muted">${tr("voiceTranscript")}</div>
        <p data-voice-transcript aria-live="polite"></p>
      </section>
      <div class="notice warn ${session.error ? "" : "hidden"}" data-voice-error role="alert">${esc(session.error)}</div>
      <p class="small muted">${tr("voiceConsentNote")}</p>
      <label class="voice-consent">
        <input class="check" type="checkbox" data-voice-consent>
        <span>${tr("voiceConsent")}</span>
      </label>
      <div class="voice-actions">
        <button class="button soft" type="button" data-action="voice-again">${tr("voiceRecordAgain")}</button>
        <button class="button primary" type="button" data-action="voice-transcribe" disabled>${tr("voiceSend")}</button>
        <button class="button primary hidden" type="button" data-action="voice-review" disabled>${tr("voiceReviewAction")}</button>
        <button class="button" type="button" data-action="voice-cancel">${tr("voiceManual")}</button>
      </div>
    </div>
  `);
  renderVoiceFeedback(session);
}

function renderVoiceFeedback(session) {
  if (state.voice !== session) return;
  const panel = modalRoot.querySelector("[data-voice-panel]");
  if (!panel) return;

  const statusText = {
    idle: tr("voiceIdle"), recording: tr("voiceListening"), processing: tr("voiceProcessing"),
    recorded: tr("voiceRecorded"), uploading: session.uploadPercent == null
      ? tr("voiceUploading") : tx("voiceUploadProgress", { percent: session.uploadPercent }),
    transcribing: tr("voiceTranscribing"), review: tr("voiceReview"), error: tr("voiceError")
  }[session.status];

  panel.querySelector("[data-voice-status]").textContent = statusText;
  panel.querySelector("[data-voice-transcript]").textContent = session.transcript || "—";
  const alert = panel.querySelector("[data-voice-error]");
  const alertText = session.error || (session.draft && !session.draft.amount ? tr("voiceMissingAmount") :
    session.draft?.needsPayer ? tr("voicePayerUnknown") : "");
  alert.textContent = alertText;
  alert.classList.toggle("hidden", !alertText);

  const button = panel.querySelector('[data-action="voice-start"]');
  button.textContent = session.status === "recording" ? "■" : "🎙";
  panel.querySelector("[data-voice-wave]").classList.toggle("active", session.status === "recording");

  const minutes = String(Math.floor(session.durationSeconds / 60)).padStart(2, "0");
  const seconds = String(session.durationSeconds % 60).padStart(2, "0");
  panel.querySelector("[data-voice-timer]").textContent = `${minutes}:${seconds} / 01:00`;

  panel.querySelector('[data-action="voice-transcribe"]').disabled = !(session.status === "recorded" && session.consent && session.blob);
  panel.querySelector('[data-action="voice-transcribe"]').classList.toggle("hidden", session.status === "review");

  const reviewBtn = panel.querySelector('[data-action="voice-review"]');
  reviewBtn.classList.toggle("hidden", session.status !== "review");
  reviewBtn.disabled = session.status !== "review" || !session.draft;
}

async function startVoice() {
  const session = state.voice;
  if (!session) return;
  session.error = "";
  session.transcript = "";
  session.draft = null;
  session.chunks = [];

  try {
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      .find(type => MediaRecorder.isTypeSupported?.(type)) || "";
    session.recorder = new MediaRecorder(session.stream, mimeType ? { mimeType } : undefined);
    session.recorder.ondataavailable = event => { if (event.data?.size) session.chunks.push(event.data); };
    session.recorder.onstop = () => {
      session.blob = new Blob(session.chunks, { type: session.recorder?.mimeType || "audio/webm" });
      session.status = session.error ? "error" : "recorded";
      renderVoiceFeedback(session);
    };

    session.startedAt = Date.now();
    session.durationSeconds = 0;
    session.status = "recording";
    session.recorder.start(250);
    clearInterval(session.timer);
    session.timer = setInterval(() => {
      if (state.voice !== session) return;
      session.durationSeconds = Math.min(60, Math.floor((Date.now() - session.startedAt) / 1000));
      renderVoiceFeedback(session);
      if (session.durationSeconds >= 60) stopVoice();
    }, 500);
    renderVoiceFeedback(session);
  } catch (err) {
    session.status = "error";
    session.error = tr("voicePermission");
    renderVoiceFeedback(session);
  }
}

function stopVoice() {
  const session = state.voice;
  if (!session || session.status !== "recording") return;
  clearInterval(session.timer);
  session.durationSeconds = Math.min(60, Math.floor((Date.now() - session.startedAt) / 1000));
  session.status = "processing";
  session.recorder?.stop();
  session.stream?.getTracks().forEach(t => t.stop());
  renderVoiceFeedback(session);
}

function disposeVoiceSession(session) {
  if (!session) return;
  clearInterval(session.timer);
  session.stream?.getTracks().forEach(t => t.stop());
  session.recorder = null;
  session.stream = null;
}

async function transcribeVoice(session) {
  if (!session?.blob || !session.consent) return;
  session.status = "uploading";
  session.uploadPercent = 0;
  renderVoiceFeedback(session);

  const { data: { session: authSession } } = await state.client.auth.getSession();
  if (!authSession?.access_token) {
    session.status = "error";
    session.error = tr("voiceSessionExpired");
    return renderVoiceFeedback(session);
  }

  const formData = new FormData();
  formData.append("audio", session.blob, "recording.webm");
  formData.append("language", session.language);

  const functionUrl = `${state.client.supabaseUrl}/functions/v1/transcribe-expense`;
  const request = new XMLHttpRequest();
  session.upload = request;

  request.upload.onprogress = event => {
    if (!event.lengthComputable) return;
    session.uploadPercent = Math.min(99, Math.round((event.loaded / event.total) * 100));
    renderVoiceFeedback(session);
  };

  request.onload = () => {
    session.upload = null;
    let payload = {};
    try { payload = JSON.parse(request.responseText || "{}"); } catch {}

    if (request.status >= 200 && request.status < 300 && payload.transcript) {
      session.status = "review";
      session.transcript = payload.transcript;
      session.draft = parseVoiceTranscript(payload.transcript, {
        members: state.members,
        currentUserId: state.user.id
      });
      renderVoiceFeedback(session);
    } else {
      session.status = "error";
      session.error = tr(transcriptionFailureKey(request.status, payload.code));
      renderVoiceFeedback(session);
    }
  };

  request.onerror = () => {
    session.status = "error";
    session.error = tr("voiceNetworkError");
    renderVoiceFeedback(session);
  };

  request.open("POST", functionUrl);
  request.setRequestHeader("Authorization", `Bearer ${authSession.access_token}`);
  request.send(formData);
}

function reviewVoiceExpense() {
  const session = state.voice;
  if (!session?.draft || !session.transcript) return;
  const draft = session.draft;
  const voiceMessage = [
    session.transcript,
    !draft.amount ? tr("voiceMissingAmount") : "",
    draft.needsPayer ? tr("voicePayerUnknown") : ""
  ].filter(Boolean).join(" — ");
  closeModal();
  expenseForm({ ...draft, occurred: draft.occurred || today(), voiceMessage });
}

// RECURRING BILL FORMS
function showBillForm(bill = null) {
  const isEdit = Boolean(bill);
  modal(isEdit ? "Edit recurring bill" : tr("recurring"), `
    <form data-form="bill" data-id="${bill?.id || ""}">
      <label class="field-label">${tr("description")}<input class="field" name="title" maxlength="100" value="${esc(bill?.title || "")}" placeholder="e.g. Fiber Internet" required></label>
      <div class="form-grid">
        <label class="field-label">${tr("amount")} (₹)<input class="field" name="amount" type="number" min="0.01" step="0.01" value="${bill?.amount || ""}" required></label>
        <label class="field-label">${tr("category")}<select class="field" name="category">
          ${allCategoriesList().map(([id]) => `<option value="${id}" ${bill?.category === id ? "selected" : ""}>${esc(categoryName(id))}</option>`).join("")}
        </select></label>
        <label class="field-label">${tr("paidBy")}${memberSelect(bill?.paid_by)}</label>
        <label class="field-label">${tr("funding")}<select class="field" name="funding">
          <option value="shared" ${bill?.funding === "shared" ? "selected" : ""}>${tr("shared")}</option>
          <option value="personal" ${bill?.funding === "personal" ? "selected" : ""}>${tr("personal")}</option>
        </select></label>
        <label class="field-label">${tr("date")}<input class="field" name="next_due" type="date" value="${bill?.next_due || today()}" required></label>
        <label class="field-label">Repeat<select class="field" name="cadence">
          <option value="monthly" ${bill?.cadence === "monthly" ? "selected" : ""}>${tr("cadenceMonthly")}</option>
          <option value="weekly" ${bill?.cadence === "weekly" ? "selected" : ""}>${tr("cadenceWeekly")}</option>
          <option value="yearly" ${bill?.cadence === "yearly" ? "selected" : ""}>${tr("cadenceYearly")}</option>
        </select></label>
      </div>
      <p class="small muted">${tr("scheduledOnly")}</p>
      <button class="button primary">${tr("save")}</button>
    </form>
  `);
}

function showBillConfirmation(bill) {
  modal(tr("confirmPaymentTitle"), `
    <p><strong>${esc(bill.title)}</strong> · Scheduled due ${dateLabel(bill.next_due)}</p>
    <p class="small muted">${tr("actualPaymentHelp")}</p>
    <form data-form="bill-payment" data-id="${bill.id}">
      <label class="field-label">${tr("amount")} (₹)<input class="field" name="amount" type="number" min="0.01" step="0.01" value="${esc(bill.amount)}" required></label>
      <label class="field-label">${tr("paidBy")}${memberSelect(bill.paid_by)}</label>
      <label class="field-label">${tr("funding")}<select class="field" name="funding">
        <option value="shared" ${bill.funding === "shared" ? "selected" : ""}>${tr("shared")}</option>
        <option value="personal" ${bill.funding === "personal" ? "selected" : ""}>${tr("personal")}</option>
      </select></label>
      <label class="field-label">${tr("date")}<input class="field" name="paid_on" type="date" value="${today()}" max="${today()}" required></label>
      <button class="button primary">${tr("confirmPaid")}</button>
    </form>
  `);
}

// SAVINGS GOAL FORMS
function showGoalCreate(goal = null) {
  const isEdit = Boolean(goal);
  modal(isEdit ? "Edit goal" : tr("goalAdd"), `
    <form data-form="goal" data-id="${goal?.id || ""}">
      <label class="field-label">${tr("description")}<input class="field" name="title" maxlength="100" value="${esc(goal?.title || "")}" placeholder="e.g. New Refrigerator" required></label>
      <label class="field-label">${tr("target")} (₹)<input class="field" name="target_amount" type="number" min="0.01" step="0.01" value="${goal?.target_amount || ""}" required></label>
      <label class="field-label">${tr("deadline")}<input class="field" name="deadline" type="date" value="${goal?.deadline || ""}" min="${today()}"></label>
      <button class="button primary">${tr("save")}</button>
    </form>
  `);
}

function showGoalForm(goalId) {
  const goal = state.goals.find(item => item.id === goalId);
  if (!goal) return;
  modal(tr("contribute"), `
    <p><strong>${esc(goal.title)}</strong> · Target ${money(goal.target_amount)}</p>
    <form data-form="contribution" data-id="${goal.id}">
      <label class="field-label">${tr("amount")} (₹)<input class="field" name="amount" type="number" min="0.01" step="0.01" required></label>
      <label class="field-label">${tr("date")}<input class="field" name="contributed_on" type="date" value="${today()}" max="${today()}" required></label>
      <button class="button primary">${tr("save")}</button>
    </form>
  `);
}

// SETTLEMENT DIALOG
function showSettlementDialog({ user_id, name, amount }) {
  modal(`Pay ${money(amount)} to ${esc(name)}`, `
    <p>Record this only after you have paid <strong>${esc(name)}</strong>. The app records the payment; it does not transfer money.</p>
    <form data-form="settlement" data-user="${esc(user_id)}">
      <label class="field-label">${tr("amount")} (₹)
        <input class="field" name="amount" type="number" min="0.01" step="0.01" value="${amount}" max="${amount}" required>
      </label>
      <label class="field-label">${tr("date")}
        <input class="field" name="settled_on" type="date" value="${today()}" max="${today()}" required>
      </label>
      <label class="field-label">${tr("notes")}
        <input class="field" name="notes" placeholder="e.g. Paid via UPI" maxlength="100">
      </label>
      <button class="button primary" style="margin-top:14px;">Confirm payment</button>
    </form>
  `);
}

// ROOM MANAGEMENT MODALS
function showRoomForm(room = null) {
  const isEdit = Boolean(room);
  modal(isEdit ? tr("editRoom") : tr("addRoom"), `
    <form data-form="room" data-id="${room?.id || ""}">
      <label class="field-label">${tr("roomNameField")}
        <input class="field" name="name" maxlength="60" value="${esc(room?.name || "")}" placeholder="e.g. Master Bedroom" required>
      </label>
      <label class="field-label">Icon / Space type
        <select class="field" name="icon">
          <option value="bed" ${room?.icon === "bed" ? "selected" : ""}>Bedroom (🛏)</option>
          <option value="utensils" ${room?.icon === "utensils" ? "selected" : ""}>Kitchen (🍳)</option>
          <option value="tv" ${room?.icon === "tv" ? "selected" : ""}>Living Room (🛋)</option>
          <option value="bath" ${room?.icon === "bath" ? "selected" : ""}>Bathroom (🚿)</option>
          <option value="car" ${room?.icon === "car" ? "selected" : ""}>Garage (🚗)</option>
          <option value="flower" ${room?.icon === "flower" ? "selected" : ""}>Garden / Balcony (🪴)</option>
          <option value="home" ${room?.icon === "home" ? "selected" : ""}>General Area (🏠)</option>
        </select>
      </label>
      <button class="button primary" style="margin-top:14px;">${tr("save")}</button>
    </form>
  `);
}

function showDeleteRoomDialog(roomId, name) {
  const linkedExpenses = state.expenses.filter(e => !e.deleted_at && e.room_id === roomId);
  const otherRooms = state.rooms.filter(r => !r.deleted_at && r.id !== roomId);

  modal(tr("deleteRoom"), `
    <p>Delete <strong>${esc(name)}</strong>?</p>
    <p class="small muted">
      ${linkedExpenses.length ? `This room is linked to ${linkedExpenses.length} historical expense(s). We preserve all financial data by reassigning them or leaving them unassigned.` : `No expenses are linked to this room.`}
    </p>

    <form data-form="delete-room-confirm" data-id="${esc(roomId)}">
      ${linkedExpenses.length && otherRooms.length ? `
        <label class="field-label">${tr("reassignExpensesTo")}
          <select class="field" name="reassign_to">
            <option value="">${tr("leaveUnassigned")}</option>
            ${otherRooms.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}
          </select>
        </label>
      ` : ""}
      <div class="grid-two" style="margin-top:20px;">
        <button class="button" type="button" data-action="close">${tr("cancel")}</button>
        <button class="button danger" type="submit">${tr("delete")}</button>
      </div>
    </form>
  `);
}

// SPENDING ALERT MODAL
function showAddSpendingAlert() {
  modal(tr("addAlert"), `
    <form data-form="spending-alert">
      <label class="field-label">Alert name
        <input class="field" name="title" maxlength="80" placeholder="e.g. Dining out threshold" required>
      </label>
      <label class="field-label">${tr("category")} (Optional)
        <select class="field" name="category">
          <option value="">All spending</option>
          ${allCategoriesList().map(([id]) => `<option value="${id}">${esc(categoryName(id))}</option>`).join("")}
        </select>
      </label>
      <label class="field-label">${tr("threshold")}
        <input class="field" name="threshold" type="number" min="1" step="0.01" placeholder="e.g. 5000" required>
      </label>
      <button class="button primary" style="margin-top:14px;">${tr("save")}</button>
    </form>
  `);
}

// CSV EXPORT
function downloadCsv() {
  const fields = ["occurred_on", "description", "category", "amount", "paid_by", "funding", "room", "payment_method", "notes", "source"];
  const rows = [fields, ...state.expenses.filter(e => !e.deleted_at).map(e => [
    e.occurred_on,
    e.description,
    categoryName(e.category),
    e.amount,
    profileName(e.paid_by),
    e.funding,
    roomName(e.room_id) || "None",
    paymentMethodName(e.payment_method),
    e.notes || "",
    e.source || "manual"
  ])];

  const csv = rows.map(row => row.map(field => {
    const text = String(field ?? "");
    const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");

  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `hearth-${state.room.name.replace(/[^a-z0-9-]/gi, "-")}-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// FORM SUBMISSIONS HANDLER
async function handleForm(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();

  if (form.dataset.form === "expense") {
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  }

  const data = new FormData(form);
  const value = key => String(data.get(key) || "").trim();
  const roomId = state.room?.id;
  const formType = form.dataset.form;

  switch (formType) {
    case "auth": {
      const mode = form.dataset.mode;
      const credentials = { email: value("email"), password: value("password") };
      if (mode === "signup") {
        const { data: res, error } = await state.client.auth.signUp({
          ...credentials,
          options: { data: { display_name: value("display_name") } }
        });
        if (error) throw error;
        if (res.session) await bootstrap();
        else flash(tr("signUpSuccess"));
      } else {
        const { error } = await state.client.auth.signInWithPassword(credentials);
        if (error) throw error;
        await bootstrap();
      }
      break;
    }

    case "create-room": {
      const { data: newId, error } = await state.client.rpc("create_household", { household_name: value("name") });
      if (error) throw error;
      localStorage.setItem("hearth.room", newId);
      closeModal();
      await bootstrap();
      flash(tr("roomCreated"));
      break;
    }

    case "join-room": {
      const { data: joinedId, error } = await state.client.rpc("join_household", { invite: value("invite") });
      if (error) throw error;
      localStorage.setItem("hearth.room", joinedId);
      closeModal();
      await bootstrap();
      flash(tr("roomJoined"));
      break;
    }

    case "expense": {
      const id = form.dataset.id;
      const amount = Number(value("amount"));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero.");

      const payload = {
        household_id: roomId,
        amount,
        category: value("category"),
        description: value("description"),
        occurred_on: value("occurred_on"),
        paid_by: value("paid_by"),
        funding: value("funding"),
        room_id: value("room_id") || null,
        payment_method: value("payment_method") || "cash",
        notes: value("notes") || "",
        source: form.dataset.fingerprint ? "receipt" : "manual",
        receipt_fingerprint: form.dataset.fingerprint || null
      };

      if (id) {
        // Update existing expense
        const { error } = await state.client.from("expenses").update({
          amount: payload.amount,
          category: payload.category,
          description: payload.description,
          occurred_on: payload.occurred_on,
          paid_by: payload.paid_by,
          funding: payload.funding,
          room_id: payload.room_id,
          payment_method: payload.payment_method,
          notes: payload.notes
        }).eq("id", id).eq("household_id", roomId);
        if (error) throw error;
        flash("Expense updated.");
      } else {
        // Insert new expense
        const { error } = await state.client.from("expenses").insert(payload);
        if (error) throw error;
        flash("Expense recorded.");
      }

      closeModal();
      await refreshRoom();
      break;
    }

    case "shopping-add": {
      const quantity = Number(value("quantity"));
      const price = value("price") ? Number(value("price")) : null;
      const { error } = await state.client.from("shopping_items").insert({
        household_id: roomId,
        name: value("name"),
        quantity,
        unit: value("unit"),
        estimated_unit_price: price,
        created_by: state.user.id
      });
      if (error) throw error;
      form.reset();
      await refreshRoom();
      flash("Added to shared list.");
      break;
    }

    case "grocery-convert": {
      const itemId = form.dataset.id;
      const { error } = await state.client.rpc("convert_shopping_item", {
        item_id: itemId,
        actual_unit_price: Number(value("price")),
        paid_by_user: state.user.id,
        funding_source: value("funding"),
        purchased_on: today()
      });
      if (error) throw error;
      closeModal();
      await refreshRoom();
      flash("Purchased item linked to one household expense.");
      break;
    }

    case "bill": {
      const billId = form.dataset.id;
      const payload = {
        household_id: roomId,
        title: value("title"),
        amount: Number(value("amount")),
        category: value("category"),
        paid_by: value("paid_by"),
        funding: value("funding"),
        cadence: value("cadence"),
        next_due: value("next_due"),
        created_by: state.user.id
      };

      if (billId) {
        const { error } = await state.client.from("recurring_bills").update(payload).eq("id", billId).eq("household_id", roomId);
        if (error) throw error;
        flash("Bill updated.");
      } else {
        const { error } = await state.client.from("recurring_bills").insert(payload);
        if (error) throw error;
        flash("Bill scheduled.");
      }
      closeModal();
      await refreshRoom();
      break;
    }

    case "bill-payment": {
      const { error } = await state.client.rpc("add_bill_payment", {
        bill_id: form.dataset.id,
        actual_amount: Number(value("amount")),
        actual_paid_by: value("paid_by"),
        actual_funding: value("funding"),
        paid_on: value("paid_on")
      });
      if (error) throw error;
      closeModal();
      await refreshRoom();
      flash(tr("paymentRecorded"));
      break;
    }

    case "goal": {
      const goalId = form.dataset.id;
      const payload = {
        household_id: roomId,
        title: value("title"),
        target_amount: Number(value("target_amount")),
        deadline: value("deadline") || null,
        created_by: state.user.id
      };

      if (goalId) {
        const { error } = await state.client.from("savings_goals").update(payload).eq("id", goalId).eq("household_id", roomId);
        if (error) throw error;
        flash("Savings goal updated.");
      } else {
        const { error } = await state.client.from("savings_goals").insert(payload);
        if (error) throw error;
        flash("Savings goal created.");
      }
      closeModal();
      await refreshRoom();
      break;
    }

    case "contribution": {
      const { error } = await state.client.from("savings_contributions").insert({
        household_id: roomId,
        goal_id: form.dataset.id,
        amount: Number(value("amount")),
        contributed_on: value("contributed_on"),
        contributed_by: state.user.id
      });
      if (error) throw error;
      closeModal();
      await refreshRoom();
      flash("Savings contribution recorded.");
      break;
    }

    case "settlement": {
      if (!isHouseholdOwner()) throw new Error("Only the household owner can record reimbursements.");
      const toUser = form.dataset.user;
      const amount = Number(value("amount"));
      const settledOn = value("settled_on") || today();
      const notes = value("notes") || "";
      const balance = calculatePersonalReimbursements({
        members: state.members,
        expenses: state.expenses,
        settlements: state.settlements,
        currentUserId: state.user.id
      }).find(item => item.member.user_id === toUser);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero.");
      if (!balance || amount > balance.outstanding) throw new Error("The reimbursement balance changed. Refresh and try again.");
      if (settledOn > today()) throw new Error("Settlement date cannot be in the future.");

      const { error } = await state.client.rpc("record_settlement", {
        household: roomId,
        other_user: toUser,
        paid_amount: amount,
        payment_date: settledOn,
        payment_notes: notes
      });
      if (error) throw error;
      closeModal();
      await refreshRoom();
      flash("Reimbursement recorded.");
      break;
    }

    case "room": {
      const id = form.dataset.id;
      const name = value("name");
      const icon = value("icon") || "home";

      if (id) {
        const { error } = await state.client.from("rooms").update({ name, icon }).eq("id", id).eq("household_id", roomId);
        if (error) throw error;
        flash("Room updated.");
      } else {
        const { error } = await state.client.from("rooms").insert({ household_id: roomId, name, icon });
        if (error) throw error;
        flash("Room added.");
      }
      closeModal();
      await refreshRoom();
      break;
    }

    case "delete-room-confirm": {
      const targetId = form.dataset.id;
      const reassignTo = value("reassign_to") || null;

      // Try RPC first, fallback to manual update + delete
      const { error: rpcErr } = await state.client.rpc("delete_room_safe", {
        target_room_id: targetId,
        reassign_to: reassignTo
      });

      if (rpcErr) {
        await state.client.from("expenses").update({ room_id: reassignTo }).eq("room_id", targetId).eq("household_id", roomId);
        const { error: delErr } = await state.client.from("rooms").delete().eq("id", targetId).eq("household_id", roomId);
        if (delErr) throw delErr;
      }

      closeModal();
      await refreshRoom();
      flash("Room deleted.");
      break;
    }

    case "spending-alert": {
      const title = value("title");
      const category = value("category") || null;
      const threshold = Number(value("threshold"));

      const { error } = await state.client.from("spending_alerts").insert({
        household_id: roomId,
        title,
        category,
        threshold_amount: threshold,
        created_by: state.user.id
      });
      if (error) throw error;
      closeModal();
      await refreshRoom();
      flash("Spending alert saved.");
      break;
    }

    case "profile": {
      const { error } = await state.client.from("user_profiles").upsert({
        user_id: state.user.id,
        display_name: value("display_name"),
        language: value("language"),
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      state.profile = { ...state.profile, display_name: value("display_name"), language: value("language") };
      await refreshRoom();
      flash("Preferences saved.");
      break;
    }

    default: return;
  }
}

// ACTION HANDLERS
async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  const roomId = state.room?.id;

  switch (action) {
    case "navigate":
      state.page = button.dataset.value;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;

    case "check-app-update": {
      button.disabled = true;
      button.textContent = tr("checkingUpdates");
      try {
        const response = await fetch(GITHUB_RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
          cache: "no-store"
        });
        if (!response.ok) {
          if (response.status === 404) throw new Error(tr("releaseNotFound"));
          throw new Error(`Could not check GitHub releases (HTTP ${response.status}).`);
        }
        const release = await response.json();
        const update = getApkReleaseUpdate(release);
        if (!update.hasUpdate) {
          flash(tr("appUpToDate"));
          break;
        }
        modal(tr("appUpdates"), `
          <p>${esc(tx("updateAvailable", { version: update.version }))}</p>
          <a class="button primary" href="${esc(update.downloadUrl)}">${tr("downloadUpdate")}</a>
        `);
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = tr("checkUpdates");
        }
      }
      break;
    }

    case "calendar-day":
      state.calendarSelectedDate = button.dataset.value;
      render();
      break;

    case "navigate-ledger-settlements":
      state.page = "ledger";
      state.ledgerSubtab = "settlements";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;

    case "ledger-tab":
      state.ledgerSubtab = button.dataset.value === "settlements" && isHouseholdOwner() ? "settlements" : "all";
      render();
      break;

    case "toggle-theme":
      localStorage.setItem("hearth.theme", localStorage.getItem("hearth.theme") === "dark" ? "light" : "dark");
      render();
      break;

    case "auth-tab": {
      const form = app.querySelector('[data-form="auth"]');
      form.dataset.mode = button.dataset.value;
      form.querySelector('[name="display_name"]').required = button.dataset.value === "signup";
      form.querySelector('[name="password"]').autocomplete = button.dataset.value === "signup" ? "new-password" : "current-password";
      app.querySelectorAll("[data-action='auth-tab']").forEach(tab => tab.classList.toggle("on", tab === button));
      form.querySelector("button[type=submit]").textContent = button.dataset.value === "signup" ? tr("signUp") : tr("signIn");
      break;
    }

    case "copy-invite":
      try {
        await navigator.clipboard.writeText(button.dataset.code);
        flash("Invite code copied to clipboard!");
      } catch {
        flash(`Invite code: ${button.dataset.code}`);
      }
      break;

    case "expense": expenseForm(); break;
    case "close": case "dismiss": closeModal(); break;
    case "voice": openVoiceEntry(); break;
    case "voice-start":
      if (state.voice?.status === "recording") stopVoice();
      else startVoice();
      break;
    case "voice-again":
      if (state.voice) {
        state.voice.blob = null;
        state.voice.transcript = "";
        state.voice.draft = null;
        state.voice.error = "";
        state.voice.status = "idle";
        state.voice.consent = false;
        modalRoot.querySelector("[data-voice-consent]").checked = false;
        renderVoiceFeedback(state.voice);
        startVoice();
      }
      break;
    case "voice-transcribe": transcribeVoice(state.voice); break;
    case "voice-review": reviewVoiceExpense(); break;
    case "voice-cancel": closeModal(); expenseForm(); break;

    case "view-expense":
      viewExpenseDetails(id);
      break;

    case "edit-expense": {
      closeModal();
      const expense = state.expenses.find(e => e.id === id);
      if (expense) {
        expenseForm({
          id: expense.id,
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          occurred: expense.occurred_on,
          paid_by: expense.paid_by,
          funding: expense.funding,
          room_id: expense.room_id || "",
          payment_method: expense.payment_method || "cash",
          notes: expense.notes || "",
          fingerprint: expense.receipt_fingerprint || ""
        });
      }
      break;
    }

    case "delete-expense": {
      closeModal();
      const expense = state.expenses.find(e => e.id === id);
      if (!expense) return;

      confirmDestructive({
        title: tr("deleteExpense"),
        message: `Delete “${expense.description}” (${money(expense.amount)})?`,
        details: "This will remove the transaction and update your balances. You can undo within 8 seconds.",
        confirmLabel: tr("delete"),
        onConfirm: async () => {
          // Remove from state immediately for responsive feel
          const original = { ...expense };
          const { error } = await state.client.from("expenses").delete().eq("id", id).eq("household_id", roomId);
          if (error) throw error;
          await refreshRoom();

          showUndoToast("Expense deleted", async () => {
            // Re-insert authoritative record
            delete original.id;
            const { error: restoreErr } = await state.client.from("expenses").insert(original);
            if (restoreErr) throw restoreErr;
            await refreshRoom();
            flash("Expense restored.");
          });
        }
      });
      break;
    }

    case "trigger-undo":
      if (state.undoAction) {
        clearInterval(state.undoCountdownInterval);
        clearTimeout(state.undoTimer);
        const cb = state.undoAction;
        state.undoAction = null;
        toastBox.classList.remove("show");
        try {
          await cb();
        } catch (err) {
          showError(err);
        }
      }
      break;

    case "settle-dialog":
      if (!isHouseholdOwner()) throw new Error("Only the household owner can pay reimbursements.");
      showSettlementDialog({
        user_id: button.dataset.user,
        name: button.dataset.name,
        amount: Number(button.dataset.amount)
      });
      break;

    case "reverse-settlement": {
      if (!isHouseholdOwner()) throw new Error("Only the household owner can reverse a reimbursement.");
      const settlement = state.settlements.find(s => s.id === id);
      if (!settlement) return;

      confirmDestructive({
        title: tr("reverseSettlement"),
        message: `Reverse repayment of ${money(settlement.amount)} to ${profileName(settlement.to_user)}?`,
        details: "This will restore the outstanding personal reimbursement liability.",
        confirmLabel: "Reverse",
        onConfirm: async () => {
          const original = { ...settlement };
          const { error } = await state.client.from("settlements").delete().eq("id", id).eq("household_id", roomId);
          if (error) throw error;
          await refreshRoom();

          showUndoToast("Settlement reversed", async () => {
            const { error: restoreErr } = await state.client.rpc("record_settlement", {
              household: roomId,
              other_user: original.to_user,
              paid_amount: original.amount,
              payment_date: original.settled_on,
              payment_notes: original.notes || ""
            });
            if (restoreErr) throw restoreErr;
            await refreshRoom();
            flash("Settlement restored.");
          });
        }
      });
      break;
    }

    case "purchased": {
      const item = state.shopping.find(row => row.id === id);
      if (!item) return;
      const { error } = await state.client.from("shopping_items").update({
        purchased: true,
        purchased_by: state.user.id,
        purchased_at: new Date().toISOString()
      }).eq("id", id).eq("household_id", roomId);
      if (error) throw error;
      await refreshRoom();
      break;
    }

    case "unpurchase": {
      const { error } = await state.client.from("shopping_items").update({
        purchased: false,
        purchased_by: null,
        purchased_at: null
      }).eq("id", id).eq("household_id", roomId);
      if (error) throw error;
      await refreshRoom();
      break;
    }

    case "delete-shopping-item": {
      const item = state.shopping.find(row => row.id === id);
      if (!item) return;
      const original = { ...item };
      const { error } = await state.client.from("shopping_items").delete().eq("id", id).eq("household_id", roomId);
      if (error) throw error;
      await refreshRoom();

      showUndoToast("Item removed", async () => {
        delete original.id;
        await state.client.from("shopping_items").insert(original);
        await refreshRoom();
      });
      break;
    }

    case "clear-completed-shopping": {
      confirmDestructive({
        title: tr("clearCompleted"),
        message: tr("confirmClearCompleted"),
        confirmLabel: "Clear",
        onConfirm: async () => {
          const { error } = await state.client.from("shopping_items").delete().eq("household_id", roomId).eq("purchased", true);
          if (error) throw error;
          await refreshRoom();
          flash("Completed items cleared.");
        }
      });
      break;
    }

    case "convert-grocery": {
      const item = state.shopping.find(row => row.id === id);
      if (!item) return;
      modal(tr("convert"), `
        <form data-form="grocery-convert" data-id="${id}">
          <p><strong>${esc(item.name)}</strong> · ${Number(item.quantity)} ${esc(item.unit)}</p>
          <label class="field-label">${tr("actualPrice")} (₹)<input class="field" name="price" type="number" min="0.01" step="0.01" value="${esc(item.estimated_unit_price ?? "")}" required></label>
          <label class="field-label">${tr("funding")}<select class="field" name="funding">
            <option value="shared">${tr("shared")}</option>
            <option value="personal">${tr("personal")}</option>
          </select></label>
          <p class="small muted">${tr("convertAccounting")}</p>
          <button class="button primary">${tr("convert")}</button>
        </form>
      `);
      break;
    }

    case "bill-add": showBillForm(); break;
    case "edit-bill-dialog": {
      const bill = state.bills.find(b => b.id === id);
      if (bill) showBillForm(bill);
      break;
    }

    case "toggle-bill-active": {
      const bill = state.bills.find(b => b.id === id);
      if (!bill) return;
      const { error } = await state.client.from("recurring_bills").update({ active: !bill.active }).eq("id", id).eq("household_id", roomId);
      if (error) throw error;
      await refreshRoom();
      flash(bill.active ? "Bill paused." : "Bill resumed.");
      break;
    }

    case "delete-bill": {
      const bill = state.bills.find(b => b.id === id);
      if (!bill) return;
      confirmDestructive({
        title: "Delete recurring bill",
        message: `Delete “${bill.title}”?`,
        details: "Scheduled reminders will stop. Past recorded expenses will NOT be deleted.",
        confirmLabel: tr("delete"),
        onConfirm: async () => {
          const original = { ...bill };
          const { error } = await state.client.from("recurring_bills").delete().eq("id", id).eq("household_id", roomId);
          if (error) throw error;
          await refreshRoom();

          showUndoToast("Bill deleted", async () => {
            delete original.id;
            await state.client.from("recurring_bills").insert(original);
            await refreshRoom();
          });
        }
      });
      break;
    }

    case "confirm-bill": {
      const bill = state.bills.find(row => row.id === id);
      if (bill) showBillConfirmation(bill);
      break;
    }

    case "goal-add": showGoalCreate(); break;
    case "edit-goal-dialog": {
      const goal = state.goals.find(g => g.id === id);
      if (goal) showGoalCreate(goal);
      break;
    }
    case "contribute": showGoalForm(id); break;

    case "delete-goal": {
      const goal = state.goals.find(g => g.id === id);
      if (!goal) return;
      confirmDestructive({
        title: "Delete savings goal",
        message: `Delete “${goal.title}”?`,
        details: "This deletes the goal. Linked savings contribution records will also be deleted.",
        confirmLabel: tr("delete"),
        onConfirm: async () => {
          const original = { ...goal };
          const { error } = await state.client.from("savings_goals").delete().eq("id", id).eq("household_id", roomId);
          if (error) throw error;
          await refreshRoom();

          showUndoToast("Savings goal deleted", async () => {
            delete original.id;
            await state.client.from("savings_goals").insert(original);
            await refreshRoom();
          });
        }
      });
      break;
    }

    case "add-room-dialog": showRoomForm(); break;
    case "edit-room-dialog": {
      const room = state.rooms.find(r => r.id === id);
      if (room) showRoomForm(room);
      break;
    }
    case "delete-room-dialog":
      showDeleteRoomDialog(id, button.dataset.name);
      break;

    case "add-spending-alert-dialog": showAddSpendingAlert(); break;

    case "add-budget-dialog": {
      modal(tr("addBudget"), `
        <form data-form="budget-add">
          <label class="field-label">${tr("category")}
            <select class="field" name="category">
              ${allCategoriesList().map(([cid]) => `<option value="${cid}">${esc(categoryName(cid))}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">${tr("monthlyLimit")} (₹)
            <input class="field" name="limit" type="number" min="1" step="0.01" required>
          </label>
          <button class="button primary" style="margin-top:14px;">${tr("save")}</button>
        </form>
      `, {
        onOpen: () => {
          modalRoot.querySelector('form[data-form="budget-add"]')?.addEventListener("submit", async e => {
            e.preventDefault();
            const form = e.target;
            const data = new FormData(form);
            const { error } = await state.client.from("category_budgets").upsert({
              household_id: roomId,
              category: String(data.get("category")),
              monthly_limit: Number(data.get("limit")),
              updated_by: state.user.id,
              updated_at: new Date().toISOString()
            }, { onConflict: "household_id,category" });
            if (error) throw error;
            closeModal();
            await refreshRoom();
            flash("Category budget saved.");
          });
        }
      });
      break;
    }

    case "delete-budget": {
      confirmDestructive({
        title: "Delete budget",
        message: "Delete this category budget limit?",
        confirmLabel: tr("delete"),
        onConfirm: async () => {
          const { error } = await state.client.from("category_budgets").delete().eq("id", id).eq("household_id", roomId);
          if (error) throw error;
          await refreshRoom();
          flash("Budget deleted.");
        }
      });
      break;
    }

    case "switch-room": {
      state.subscription?.unsubscribe();
      state.subscription = null;
      state.room = state.households.find(room => room.id === id);
      if (!state.room) return;
      localStorage.setItem("hearth.room", id);
      await refreshRoom();
      subscribeRealtime();
      break;
    }

    case "rename-household-dialog": {
      modal("Rename household", `
        <form data-form="rename-household">
          <label class="field-label">${tr("roomName")}
            <input class="field" name="name" maxlength="80" value="${esc(state.room.name)}" required>
          </label>
          <button class="button primary" style="margin-top:14px;">${tr("save")}</button>
        </form>
      `, {
        onOpen: () => {
          modalRoot.querySelector('form[data-form="rename-household"]')?.addEventListener("submit", async e => {
            e.preventDefault();
            const newName = String(new FormData(e.target).get("name") || "").trim();
            const { error } = await state.client.from("households").update({ name: newName }).eq("id", roomId);
            if (error) throw error;
            closeModal();
            state.room.name = newName;
            await loadHouseholds();
            await refreshRoom();
            flash("Household name updated.");
          });
        }
      });
      break;
    }

    case "toggle-member-role": {
      const targetUser = button.dataset.user;
      const newRole = button.dataset.role;
      const { error } = await state.client.from("household_members").update({ role: newRole })
        .eq("household_id", roomId).eq("user_id", targetUser);
      if (error) throw error;
      await refreshRoom();
      flash(`Member role updated to ${newRole}.`);
      break;
    }

    case "remove-member-dialog": {
      const targetUser = button.dataset.user;
      const targetName = button.dataset.name;
      confirmDestructive({
        title: tr("removeMember"),
        message: `Remove ${targetName} from ${state.room.name}?`,
        details: "Their historical expense records and payments will remain in the household ledger.",
        confirmLabel: "Remove",
        onConfirm: async () => {
          const { error } = await state.client.from("household_members").delete()
            .eq("household_id", roomId).eq("user_id", targetUser);
          if (error) throw error;
          await refreshRoom();
          flash("Member removed.");
        }
      });
      break;
    }

    case "leave-household-dialog": {
      const myMembership = state.members.find(m => m.user_id === state.user.id);
      const isLastOwner = myMembership?.role === "owner" && state.members.filter(m => m.role === "owner").length <= 1;

      if (isLastOwner && state.members.length > 1) {
        showError(new Error("You are the only owner of this household. Make another member an owner before leaving, or delete the household."));
        return;
      }

      confirmDestructive({
        title: tr("leaveHousehold"),
        message: `Leave ${state.room.name}?`,
        details: "You will lose access to this household's financial records.",
        confirmLabel: "Leave",
        onConfirm: async () => {
          const { error } = await state.client.from("household_members").delete()
            .eq("household_id", roomId).eq("user_id", state.user.id);
          if (error) throw error;
          localStorage.removeItem("hearth.room");
          await bootstrap();
        }
      });
      break;
    }

    case "delete-household-dialog": {
      modal(tr("deleteHousehold"), `
        <p><strong>${tr("confirmDeleteHousehold")}</strong></p>
        <p class="small muted">${tr("typeHouseholdNameToConfirm")} <strong style="color:var(--danger);">${esc(state.room.name)}</strong></p>
        <form data-form="delete-household-confirm">
          <input class="field" name="confirm_name" placeholder="Type household name exactly" required>
          <div class="grid-two" style="margin-top:16px;">
            <button class="button" type="button" data-action="close">${tr("cancel")}</button>
            <button class="button danger" type="submit">${tr("deleteHousehold")}</button>
          </div>
        </form>
      `, {
        onOpen: () => {
          modalRoot.querySelector('form[data-form="delete-household-confirm"]')?.addEventListener("submit", async e => {
            e.preventDefault();
            const typed = String(new FormData(e.target).get("confirm_name") || "").trim();
            if (typed !== state.room.name) {
              showError(new Error("The household name does not match. Deletion cancelled."));
              return;
            }
            closeModal();
            const { error } = await state.client.from("households").delete().eq("id", roomId);
            if (error) throw error;
            localStorage.removeItem("hearth.room");
            await bootstrap();
            flash("Household deleted.");
          });
        }
      });
      break;
    }

    case "create-household-dialog":
      modal(tr("createRoom"), `
        <form data-form="create-room">
          <label class="field-label">${tr("roomName")}<input class="field" name="name" maxlength="80" required></label>
          <button class="button primary" style="margin-top:14px;">${tr("createRoom")}</button>
        </form>
      `);
      break;

    case "join-household-dialog":
      modal(tr("joinRoom"), `
        <form data-form="join-room">
          <label class="field-label">${tr("invite")}<input class="field" name="invite" maxlength="20" required></label>
          <button class="button primary" style="margin-top:14px;">${tr("joinRoom")}</button>
        </form>
      `);
      break;

    case "ledger-prev-page":
      state.filter.page = Math.max(1, state.filter.page - 1);
      render();
      break;

    case "ledger-next-page":
      state.filter.page += 1;
      render();
      break;

    case "csv": downloadCsv(); break;
    case "pdf": window.print(); break;

    case "signout":
      state.subscription?.unsubscribe();
      await state.client.auth.signOut();
      state.user = null;
      state.profile = null;
      state.room = null;
      render();
      break;

    default: break;
  }
}

// APP INITIALIZATION
async function start() {
  let config;
  try {
    config = await import("./supabase-config.js");
  } catch (error) {
    renderConfigError(new Error(`Copy supabase-config.js.example to supabase-config.js. ${error.message}`));
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;
  if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
    renderConfigError(new Error("Supabase project credentials have not been configured."));
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  state.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  state.client.auth.onAuthStateChange((event, session) => {
    if (event !== "INITIAL_SESSION" && session?.user?.id !== state.user?.id) {
      setTimeout(() => {
        if (session?.user?.id !== state.user?.id) bootstrap().catch(showError);
      }, 0);
    }
  });

  await bootstrap();
}

// EVENT LISTENERS
document.addEventListener("submit", async event => {
  try {
    await handleForm(event);
  } catch (error) {
    const form = event.target.closest('form[data-form="expense"]');
    if (form) {
      delete form.dataset.submitting;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = false;
    }
    showError(error);
  }
});

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button || ["purchased", "unpurchase", "receipt"].includes(button.dataset.action)) return;
  if (button.dataset.action === "dismiss" && event.target !== button) return;
  try {
    await handleAction(button);
  } catch (error) {
    showError(error);
  }
});

document.addEventListener("change", async event => {
  const target = event.target;
  if (target.matches("[data-calendar-month]")) {
    const minMonth = monthStart(-11).slice(0, 7);
    const maxMonth = monthStart().slice(0, 7);
    let val = target.value ? String(target.value).trim().slice(0, 7) : "";
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(val) && val >= minMonth && val <= maxMonth) {
      state.calendarMonth = val;
      state.calendarSelectedDate = "";
      render();
    }
  } else if (target.matches("[data-voice-language]")) {
    if (state.voice) state.voice.language = target.value;
  } else if (target.matches("[data-voice-consent]")) {
    if (state.voice) {
      state.voice.consent = target.checked;
      renderVoiceFeedback(state.voice);
    }
  } else if (target.matches('[data-action="receipt"]')) {
    try { await scanReceipt(target.files?.[0]); } catch (error) { showError(error); }
  } else if (target.matches('[data-action="purchased"]') || target.matches('[data-action="unpurchase"]')) {
    try { await handleAction(target); } catch (error) { showError(error); }
  } else if (target.matches('[data-action="filter-category"]')) {
    state.filter.category = target.value;
    state.filter.page = 1;
    render();
  } else if (target.matches('[data-action="filter-room"]')) {
    state.filter.room = target.value;
    state.filter.page = 1;
    render();
  } else if (target.matches('[data-action="filter-payer"]')) {
    state.filter.payer = target.value;
    state.filter.page = 1;
    render();
  } else if (target.matches('[data-action="filter-range"]')) {
    state.filter.range = target.value;
    state.filter.page = 1;
    render();
  } else if (target.matches('[data-action="filter-sort"]')) {
    state.filter.sort = target.value;
    render();
  }
});

document.addEventListener("input", event => {
  if (event.target.matches('[data-action="filter-search"]')) {
    state.filter.search = event.target.value;
    state.filter.page = 1;
    render();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modalRoot.firstElementChild) closeModal();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.voice) closeModal();
  if (!document.hidden && state.user && state.room) {
    refreshRoom().catch(showError);
  }
});

window.addEventListener("online", () => {
  if (!state.user || !state.room) return;
  subscribeRealtime();
  refreshRoom().catch(showError);
});

window.addEventListener("pagehide", closeModal);

start().catch(error => {
  showError(error);
  app.innerHTML = `
    <section class="panel">
      <h1>House Expense could not connect</h1>
      <p class="small muted">${esc(errorMessage(error))}</p>
      <button class="button" onclick="location.reload()">Try again</button>
    </section>
  `;
});
