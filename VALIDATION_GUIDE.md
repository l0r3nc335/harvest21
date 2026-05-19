# Pre-Push Validation Guide

## Overview

This project now includes automated validation checks to catch errors **before** pushing to GitHub/Vercel.

---

## ✅ Automatic Validation (Git Hook)

### How It Works

A **pre-push Git hook** automatically runs validation before every `git push`:

1. **TypeScript Type Check** - Catches type errors
2. **Production Build** - Ensures the code compiles

If either check fails, the push is **blocked** until you fix the errors.

### Setup (One-Time)

The Git hook is already configured in `.husky/pre-push`. If it doesn't work:

```bash
npm install
npx husky init
```

### During Git Push

```bash
git push

# You'll see:
# 🔍 Running pre-push validation checks...
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📝 Checking TypeScript types...
# ✅ TypeScript check passed
# 🔨 Running production build...
# ✅ Build passed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ All validation checks passed! Pushing...
```

---

## 🔧 Manual Validation (Windows PowerShell)

### Quick Commands

Run these **before** committing/pushing to catch errors early:

#### TypeScript Type Check Only (Fast)
```powershell
npm run type-check
```

#### Full Validation (Type Check + Build)
```powershell
npm run validate
```

#### PowerShell Script (Recommended for Windows)
```powershell
.\scripts\validate.ps1
```

### Workflow Recommendation

```powershell
# 1. Make your changes
# 2. Run quick type check
npm run type-check

# 3. If types pass, run full build
npm run build

# 4. If both pass, commit and push
git add .
git commit -m "your message"
git push  # Pre-push hook will run automatically
```

---

## 🚫 Bypassing Validation (Emergency Only)

If you **absolutely must** push without validation (not recommended):

```bash
git push --no-verify
```

⚠️ **Warning:** Only use this in emergencies. Bypassing validation will likely cause Vercel deployment failures.

---

## 📋 What Gets Checked

### TypeScript Type Check (`npm run type-check`)
- ✅ Type mismatches (string vs number, null vs undefined)
- ✅ Missing properties
- ✅ Invalid imports
- ✅ Type inference errors
- ⏱️ **Fast** (~5-10 seconds)

### Production Build (`npm run build`)
- ✅ All TypeScript checks (above)
- ✅ Component compilation
- ✅ Server/client boundaries ("use client")
- ✅ Import resolution
- ✅ Next.js route validation
- ✅ Static page generation
- ⏱️ **Slower** (~20-30 seconds)

---

## 🐛 Common Errors and Fixes

### Error: "Type 'null' is not assignable to type 'string | undefined'"
**Fix:** Update type to allow null:
```typescript
// Before
contact_user_id?: string;

// After
contact_user_id?: string | null;
```

### Error: "Property 'X' does not exist on type 'Y'"
**Fix:** Add missing property to interface/type definition

### Error: "Module not found: Can't resolve 'X'"
**Fix:** Check import paths and install missing packages

---

## 💡 Benefits

✅ **Catch errors before Vercel deployment**  
✅ **Save time** - No waiting for Vercel to fail  
✅ **Save money** - Fewer wasted build minutes  
✅ **Better code quality** - Enforces type safety  
✅ **Faster debugging** - See errors locally with full context  

---

## 🔄 CI/CD Flow

```
Local Development
    ↓
npm run type-check (Quick validation)
    ↓
git commit -m "..."
    ↓
git push
    ↓
Pre-push hook runs (Type check + Build)
    ↓ (if passed)
GitHub receives push
    ↓
Vercel builds and deploys
    ↓
✅ Deployment succeeds
```

---

## 📝 Quick Reference

| Command | Speed | What It Checks |
|---------|-------|----------------|
| `npm run type-check` | ⚡ Fast | TypeScript types only |
| `npm run build` | 🐢 Slow | Full production build |
| `npm run validate` | 🐢 Slow | Both type-check + build |
| `.\scripts\validate.ps1` | 🐢 Slow | Same as validate (Windows) |
| `git push` | 🐢 Slow | Auto-runs validation hook |

---

## 🎯 Best Practices

1. **Run `npm run type-check` frequently** during development
2. **Run `npm run build` before committing** major changes
3. **Let the Git hook run** - don't bypass it unless emergency
4. **Fix errors immediately** - don't accumulate technical debt
5. **Test locally first** - use `npm run dev` to verify functionality

---

## 🛠️ Troubleshooting

### Git hook not running?
```bash
# Reinstall husky
npm install
npx husky init
```

### Permission denied on Git hook?
```bash
# On Unix/Mac
chmod +x .husky/pre-push

# On Windows (Git Bash)
git update-index --chmod=+x .husky/pre-push
```

### Validation taking too long?
- Use `npm run type-check` for quick validation
- Full builds are necessary before push but not during development

---

## 📞 Support

If validation fails and you can't figure out why:
1. Read the error message carefully
2. Check the file and line number mentioned
3. Compare types in the error with the actual code
4. Ask for help with the specific error message

---

**Created:** 2026-01-30  
**Last Updated:** 2026-01-30
