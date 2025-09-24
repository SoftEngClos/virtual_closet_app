
# Virtual Closet (React Native + Expo)

An app to photograph, tag, and organize clothing; save/create outfits; and generate outfit suggestions.  

## 🚀 Tech stack
- React Native + Expo (TypeScript)
- VS Code + GitHub + Jira
- Backend: Firebase or Supabase (to be decided)

## 📦 Getting started
1. Clone the repo
   ```bash
   git clone git@github.com:YOURORG/virtual-closet-app.git
   cd virtual-closet-app

2. Install dependencies (make sure you have Node + npm installed)
   '''bash
   npm install

3. Run the app
   '''bash
   npx expo start


## 📦 Project Setup Notes
- Standardized on Expo SDK 54 with React Native 0.81 and React 19.1
- After pulling always run:
   '''bash
   npm install
   npx expo doctor

  to ensure that the dependencies match.

- If you see dependency conflicts (ERESOLVE), clear node_modules and reinstall: 
'''bash
   rd /s /q node_modules
   del package-lock.json
   npm install

- Main entry point is set to expo-router/entry, with tab navigation under app/(tabs)/

## 📦 Team Workflow
- Commit messages should follow the format: 
   feat: for new features
   fix: for bug fixes
   docs: for README/notes
   chore: for tooling/dependencies

- Pull latest before starting work: 
'''bash
   git pull origin main

- Push your changes
'''bash
   git add .
   git commit -m "[VC-#, Short description of addition]"
   git push origin main
