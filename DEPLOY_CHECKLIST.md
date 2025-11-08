# Production Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment

### 1. Environment Configuration
- [ ] `.env` file created with all values
- [ ] Firebase API keys configured
- [ ] Google service account credentials added
- [ ] OAuth client ID/secret configured
- [ ] Site URL set to production domain

### 2. Firebase Setup
- [ ] Firebase project created (selector-0219c)
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Storage bucket created
- [ ] Cloud Functions enabled
- [ ] Billing account linked (for Cloud Functions)

### 3. Google Cloud Setup
- [ ] Drive API enabled
- [ ] Service account created
- [ ] Service account key downloaded
- [ ] OAuth credentials created
- [ ] Redirect URLs configured:
  - [ ] `https://ravisharmaphotofilms.in/__/auth/handler`
  - [ ] `https://ravisharmaphotofilms.in`
- [ ] Test Drive folder shared with service account

### 4. Code Review
- [ ] All imports use Firebase (not Supabase)
- [ ] No hardcoded credentials
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Toast notifications working
- [ ] No console errors in production build

### 5. Security Rules
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Role-based access working
- [ ] Admin permissions verified
- [ ] Client permissions verified

## Testing

### 6. Local Testing
- [ ] App runs locally without errors
- [ ] Admin login works
- [ ] Client login works
- [ ] First user becomes admin
- [ ] Firebase emulators working

### 7. Authentication Tests
- [ ] Admin can sign up
- [ ] Admin can sign in
- [ ] Admin can sign out
- [ ] Client can sign up
- [ ] Client can sign in
- [ ] Client can sign out
- [ ] Role assignment works
- [ ] Session persistence works

### 8. Admin Panel Tests
- [ ] Add user works
- [ ] Edit user works
- [ ] Delete user works (with confirmation)
- [ ] User list displays correctly
- [ ] Realtime updates working
- [ ] All buttons functional:
  - [ ] 👁️ View Gallery
  - [ ] 🔁 Sync Drive
  - [ ] ✏️ Edit User
  - [ ] 📥 Download CSV
  - [ ] 🗑️ Delete User

### 9. Drive Sync Tests
- [ ] Can assign Drive folder to user
- [ ] Sync button triggers function
- [ ] Progress toast appears
- [ ] Success/error messages work
- [ ] Photos appear in Firestore
- [ ] Activity log created
- [ ] Photo count correct
- [ ] Duplicate detection works
- [ ] Test folder sync successful:
  ```
  https://drive.google.com/drive/folders/1rnUioPkKupwo_MW-i2GTUM3H7Xmrn-5I
  ```
- [ ] test:drive-sync script passes

### 10. Gallery Tests
- [ ] Client can view their photos
- [ ] Thumbnails load correctly
- [ ] Full images load on click
- [ ] Image preloading works
- [ ] Keyboard navigation works
- [ ] Mobile gestures work
- [ ] Admin can view any user's gallery
- [ ] Category filtering works (if folders)

### 11. Selection Tests
- [ ] Client can select photos
- [ ] Client can unselect photos
- [ ] Client can mark for later
- [ ] Selection counter accurate
- [ ] Finalize works
- [ ] Can't modify after finalize
- [ ] Admin can view selections
- [ ] CSV export includes all data

### 12. Design Tests
- [ ] Logo upload works
- [ ] Logo displays correctly
- [ ] Color changes apply instantly
- [ ] Font changes apply instantly
- [ ] Hero title/subtitle update
- [ ] Contact info updates
- [ ] Restore defaults works
- [ ] Changes persist across sessions

### 13. Feedback Tests
- [ ] Client can submit feedback
- [ ] Admin can view all feedback
- [ ] Timestamps correct
- [ ] User info displayed

### 14. Activity Logs Tests
- [ ] Logs appear in admin panel
- [ ] Sync events logged
- [ ] User actions logged
- [ ] Timestamps correct
- [ ] Pagination works (if >100 logs)

### 15. Mobile Tests
- [ ] Responsive design works
- [ ] Touch gestures work
- [ ] Mobile nav works
- [ ] Images load efficiently
- [ ] Forms work on mobile

## Deployment

### 16. Build
```bash
npm run build
```
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Bundle size reasonable (<2MB)

### 17. Deploy Cloud Functions
```bash
firebase deploy --only functions
```
- [ ] All functions deploy successfully
- [ ] No deployment errors
- [ ] Functions accessible
- [ ] syncDrive function works

### 18. Deploy Rules
```bash
firebase deploy --only firestore:rules,storage:rules
```
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] No syntax errors
- [ ] Rules validate correctly

### 19. Deploy Frontend
```bash
# Netlify
netlify deploy --prod --dir=dist

# OR Firebase Hosting
firebase deploy --only hosting
```
- [ ] Deployment successful
- [ ] Live URL accessible
- [ ] No 404 errors
- [ ] All routes work

### 20. Domain Configuration
- [ ] Custom domain connected
- [ ] SSL certificate active
- [ ] DNS records configured
- [ ] Redirects working (http → https)
- [ ] www → non-www (or vice versa)

## Post-Deployment

### 21. Production Testing
Run through all tests again on production:
- [ ] Admin signup/login
- [ ] Client signup/login
- [ ] Add user
- [ ] Sync Drive (with real folder)
- [ ] View gallery
- [ ] Make selections
- [ ] Submit feedback
- [ ] Download CSV
- [ ] Design changes
- [ ] Logo upload

### 22. Performance
- [ ] Lighthouse score >90
- [ ] Images load quickly
- [ ] No layout shifts
- [ ] Smooth animations
- [ ] No memory leaks

### 23. Monitoring Setup
- [ ] Firebase Analytics enabled
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] Usage alerts set up:
  - [ ] Firestore quota alerts
  - [ ] Function error alerts
  - [ ] Storage quota alerts

### 24. Backup Strategy
- [ ] Automatic Firestore backup scheduled
- [ ] Backup bucket created
- [ ] Restore procedure documented
- [ ] Test restore works

### 25. Documentation
- [ ] Admin guide created/updated
- [ ] Client guide created/updated
- [ ] Support contact added
- [ ] Emergency contacts listed

## Final Checks

### 26. Security Audit
- [ ] No API keys in client code
- [ ] Environment variables secure
- [ ] Service account key protected
- [ ] OAuth secrets not exposed
- [ ] Firestore rules restrict access
- [ ] Storage rules restrict access

### 27. Compliance
- [ ] Privacy policy linked
- [ ] Terms of service linked
- [ ] GDPR compliance (if EU users)
- [ ] Cookie consent (if tracking)

### 28. Client Handoff
- [ ] Admin credentials provided
- [ ] Training session scheduled
- [ ] Documentation delivered
- [ ] Support plan established

## Launch

### 29. Go-Live
- [ ] Final production test
- [ ] Inform stakeholders
- [ ] Monitor for first hour
- [ ] Check logs for errors
- [ ] Verify all features working

### 30. Post-Launch (First Week)
- [ ] Monitor usage daily
- [ ] Check error logs
- [ ] Review performance
- [ ] Gather user feedback
- [ ] Address any issues

## Ongoing Maintenance

### Weekly
- [ ] Review error logs
- [ ] Check usage/costs
- [ ] Monitor performance

### Monthly
- [ ] Review security rules
- [ ] Update dependencies
- [ ] Firestore backup verification
- [ ] Cost analysis

### Quarterly
- [ ] Security audit
- [ ] Performance optimization
- [ ] Feature review
- [ ] User feedback analysis

---

## Emergency Contacts

**Firebase Support**: https://firebase.google.com/support
**Google Cloud Support**: https://cloud.google.com/support
**Developer**: [Your contact info]

## Rollback Plan

If critical issues occur:

1. Revert to previous deployment:
```bash
firebase hosting:rollback
netlify rollback
```

2. Check logs for errors:
```bash
firebase functions:log
```

3. Disable problematic features temporarily

4. Notify users of temporary issues

5. Fix and redeploy

---

**Checklist Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: [3 months from now]
