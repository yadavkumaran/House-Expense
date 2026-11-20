# Privacy Policy for House Expense

**Last updated:** November 16, 2026

House Expense ("we", "our", or "the app") provides a household expense and budget tracking application. This Privacy Policy describes how your information is handled when you use the House Expense mobile app and web application.

---

### 1. Information We Collect

- **Account Information:** When you create an account, we collect your email address and display name via Supabase Authentication to authenticate you and associate you with your household.
- **Household & Expense Records:** Transactions, expenses, categories, payment types, settlement records, shopping list items, and savings goals that you enter are stored securely in Supabase PostgreSQL database protected by Row Level Security (RLS).
- **Audio Recordings (Voice Entry):**
  - When you use the Voice Expense Entry feature, the app requests microphone permission (`android.permission.RECORD_AUDIO`).
  - Audio recording occurs **only** when you tap the record button and terminates after a maximum of 60 seconds.
  - Before transcription, the app requests explicit user agreement.
  - Audio data is sent over TLS/HTTPS to an authenticated Supabase Edge Function which forwards it to Groq's speech-to-text service (`whisper-large-v3-turbo`) to generate a draft transaction.
  - Audio recordings are held in memory only for transcription processing and are **not** permanently saved, stored on servers, or used for model training or advertising.

---

### 2. Information Sharing & Third Parties

We do not sell, rent, or monetize your personal data. We only use trusted infrastructure providers necessary to operate the service:

- **Supabase:** Hosted database, authentication, and backend functions with TLS encryption and Row Level Security.
- **Groq:** Speech-to-text transcription for voice expense entry (only when you explicitly trigger transcription).

---

### 3. Data Retention and Security

- All communications between the app and backend services are encrypted in transit using industry-standard HTTPS / TLS.
- Database records are isolated by household using Row Level Security.
- You can delete transactions, rooms, goals, or settlement records at any time within the app.

---

### 4. Account and Data Deletion Requests

House Expense provides users with full control over their account and personal data:

- **In-App Deletion:** You can delete your account and all associated personal data directly within the app at any time by navigating to **Settings → Delete account** and confirming the prompt. If you are the sole owner of a household, that household and its records are also removed.
- **Web-Based Deletion Request:** If you are unable to access the mobile application, you can submit an account and data deletion request via our public request channel:  
  **Deletion Request URL:** https://github.com/yadavkumaran/House-Expense/issues/new?title=Account+Deletion+Request  
  Upon verification of email ownership, all user records and personal data will be permanently purged within 30 days.

---

### 5. Children’s Privacy

House Expense is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13.

---

### 6. Changes to This Policy

We may update our Privacy Policy from time to time. Any updates will be reflected on this page with an updated "Last updated" date.

---

### 7. Contact Us

If you have questions or requests regarding your data, please contact the developer via the official repository or support channel:
- **Repository:** https://github.com/yadavkumaran/House-Expense
