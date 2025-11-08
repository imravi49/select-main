/
PATCHED V2 - HOTFIX SUMMARY
---------------------------

Files fixed:

1️⃣ src/components/admin/FontManager.tsx
   - Fixed invalid Firestore path.
   - Changed 'collection(firestore, "site", "fonts")' ➜ 'collection(firestore, "site_fonts")'.
   - Changed 'doc(firestore, "site", "fonts", id)' ➜ 'doc(firestore, "site_fonts", id)'.

2️⃣ src/lib/designLoader.ts
   - Fixed secondary color binding.
   - Now recognizes both "secondaryColor" and "secondary_color" when applying background color:
       root.style.setProperty("--app-bg-color", ...)

Both fixes are surgical and additive — no unrelated code or formatting changed.

✅ After deployment:
   - Font Manager will now load fonts correctly (no invalid path error).
   - Changing Secondary Color in Design tab will immediately update background for all pages.
