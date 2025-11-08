# Golden Drive Gallery - Firebase Edition

A professional photo gallery application powered by Firebase, designed for photographers to share photo collections with clients and receive selections.

## 🎯 Overview

This is the Firebase-ready version of Golden Drive Gallery. It provides the exact same features as the Supabase version but uses Firebase as the backend:

- **Firebase Authentication** - Email/password with role-based access
- **Cloud Firestore** - NoSQL database for users, photos, selections
- **Firebase Storage** - Logo and design asset hosting
- **Cloud Functions** - Google Drive sync automation
- **Google Drive API** - Photo hosting (no duplication costs)

## ✨ Features

### For Photographers (Admin)
- 📸 Add clients and assign Drive folders
- 🔄 One-click Google Drive photo sync
- 👁️ Preview client galleries
- 📊 Track selections and activity
- 🎨 Customize branding and design
- 📥 Export selection data (CSV/BAT)

### For Clients
- 🖼️ View high-quality photos
- ✅ Select favorite photos
- ⏰ Mark photos for later review
- 📱 Mobile-responsive interface
- 💬 Submit feedback

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase account
- Google Cloud project with Drive API enabled

### Installation

1. **Clone and Setup**
```bash
cd firebase_ready
npm install
```

2. **Configure Firebase**
```powershell
.\SETUP_FIREBASE.ps1
```
This automated script will:
- Guide you through credential setup
- Create `.env` file
- Deploy Firestore rules
- Deploy Cloud Functions
- Set up Storage rules

3. **Run Locally**
```bash
npm run dev
```

4. **Create First Admin**
- Visit `http://localhost:5173`
- Sign up with email/password
- First user automatically becomes admin

## 📁 Project Structure

```
firebase_ready/
├── src/
│   ├── lib/
│   │   ├── firebaseConfig.ts      # Firebase initialization
│   │   ├── firebaseAuth.tsx       # Authentication service
│   │   ├── firebaseDb.ts          # Firestore operations
│   │   └── firebaseStorage.ts     # Storage operations
│   ├── components/
│   │   └── admin/                 # Admin panel components
│   └── pages/                     # App pages
├── functions/
│   ├── index.js                   # Cloud Functions entry
│   └── googleDriveSync.js         # Drive sync logic
├── firestore.rules                # Firestore security rules
├── storage.rules                  # Storage security rules
├── SETUP_FIREBASE.ps1             # Automated setup script
├── MIGRATION_GUIDE.md             # Supabase → Firebase migration
├── DEPLOY_CHECKLIST.md            # Production deployment steps
└── TUTORIAL.txt                   # Detailed setup tutorial
```

## 🔐 Security

### Role-Based Access Control
- **Admin**: Full access to all features
- **Client**: Can only view and select their own photos

### Firestore Rules
All data is protected by security rules:
- Users can only access their own data
- Admins can access all data
- First user automatically gets admin role

### Storage Rules
- Only admins can upload logos/assets
- All buckets use public-read, admin-write

## 🔄 Google Drive Integration

### How It Works
1. Admin adds client with Drive folder link
2. Admin clicks "Sync Drive" button
3. Cloud Function fetches all images from folder
4. Metadata stored in Firestore (filename, IDs)
5. Photos displayed using Google Drive URLs:
   - Thumbnails: `https://lh3.googleusercontent.com/d/{id}=w1000`
   - Full size: `https://lh3.googleusercontent.com/d/{id}=w4000`

### Cost Benefits
- ✅ No storage costs (photos stay on Drive)
- ✅ No bandwidth costs (served directly from Drive)
- ✅ Unlimited photo storage (Drive capacity)

### Setup Requirements
1. Create Google Cloud service account
2. Share Drive folders with service account email
3. Add credentials to Cloud Functions environment

## 🎨 Design Customization

Admins can customize:
- **Logo**: Upload custom branding
- **Colors**: Primary and secondary theme colors
- **Fonts**: Choose from 50+ Google Fonts
- **Hero**: Custom title and subtitle
- **Contact**: Email and phone display

Changes apply instantly across all users.

## 📊 Admin Features

### User Management
- Add/edit/delete clients
- Assign Drive folders
- Set selection limits
- Toggle selection visibility

### Drive Sync
- Per-user folder sync
- Progress tracking
- Error logging
- Activity history

### Analytics
- View sync history
- Track user activity
- Monitor selections
- Download reports

## 📱 Client Experience

### Gallery View
- High-quality photo display
- Smooth preloading
- Keyboard navigation
- Mobile gestures

### Selection Flow
1. Browse gallery
2. Click to select/unselect
3. Mark for later review
4. Finalize when done

### Feedback
- Submit comments/questions
- Contact photographer
- View selection summary

## 🧪 Testing

### Local Testing
```bash
# Start emulators
firebase emulators:start

# In another terminal
npm run dev
```

### Drive Sync Test
```bash
npm run test:drive-sync
```

Uses test folder:
https://drive.google.com/drive/folders/1rnUioPkKupwo_MW-i2GTUM3H7Xmrn-5I

Expected: ~53 photos synced

### Manual Test Checklist
See `DEPLOY_CHECKLIST.md` for complete testing matrix.

## 🚀 Deployment

### Option 1: Firebase Hosting
```bash
npm run build
firebase deploy
```

### Option 2: Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Post-Deployment
1. Update OAuth redirect URLs in Google Console
2. Test all features in production
3. Set up monitoring/alerts
4. Schedule Firestore backups

## 📚 Documentation

- **SETUP_FIREBASE.ps1** - Automated setup walkthrough
- **TUTORIAL.txt** - Beginner-friendly guide
- **MIGRATION_GUIDE.md** - Migrate from Supabase
- **DEPLOY_CHECKLIST.md** - Production deployment steps

## 💰 Cost Estimate

### Firebase Free Tier
- 1GB storage
- 50K document reads/day
- 20K document writes/day
- 10GB bandwidth/month

### Typical Monthly Usage
- **Storage**: <100MB (metadata only)
- **Reads**: ~5K/day (gallery views)
- **Writes**: ~500/day (selections)
- **Functions**: ~50 invocations/month (syncs)

**Estimated Cost**: $0-10/month (well within free tier)

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **UI**: shadcn/ui components
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **Image Hosting**: Google Drive API
- **Deployment**: Netlify or Firebase Hosting

## 🔧 Configuration

### Environment Variables
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=selector-0219c
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
```

### Firebase Functions Config
```bash
firebase functions:config:set google.client_email="..." google.private_key="..."
```

## 📞 Support

- **Documentation**: See TUTORIAL.txt
- **Issues**: Check MIGRATION_GUIDE.md troubleshooting
- **Firebase**: https://firebase.google.com/support
- **Drive API**: https://developers.google.com/drive/api/v3/reference

## 📄 License

Private project for Ravi Sharma Photo Films.

## 🎉 Credits

Built for professional photographers who want a seamless client experience without the complexity of traditional gallery platforms.

---

**Live Site**: https://ravisharmaphotofilms.in
**Firebase Project**: selector-0219c
