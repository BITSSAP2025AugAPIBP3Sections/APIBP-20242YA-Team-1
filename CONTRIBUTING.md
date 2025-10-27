## 📁 Project Structure
frontend/

backend/service-name

## 🚀 Getting Started
### 1️⃣ Fork & Clone
```
git clone https://github.com/BITSSAP2025AugAPIBP3Sections/APIBP-20242YA-Team-1.git
```
2️⃣ Set Up the Environment
```
npm install
```

3️⃣ Start Development
```
npm run dev
```

## Branching Strategy
Follow feature-based branching:
```
main                → stable production-ready branch  
dev                 → integration/testing branch  
feature/<name>      → new features  
fix/<name>          → bug fixes  
chore/<name>        → maintenance or config changes

E.g feature/home-page-ui
    fix/login-error

```

## Linking Issues
When creating a PR, always link the related issue using the GitHub keyword syntax in the PR description
```
Closes #<issue_number>
or Fixed #<issue_number>
```

## Code Quality & Linting
Run lint and type checks before committing:
```npm run lint```

## Pull Request Guidelines

When submitting a PR:
- Keep PRs small and focused on one change.
- Use a meaningful PR title and follow - [ServiceName] Short Description
- Describe the change clearly in the PR body. (added/updated)
- Add steps to verify functionality.
- Ensure all tests pass and build is successful.
- Reference the related issue (e.g., Closes #45).

## Code Review Process

- All PRs require at least 1 reviewer approval before merging.

- The reviewer will check for:
  - Code readability and maintainability
  - Folder structure & naming consistency
  - Proper issue linking and commit format

## License
By contributing, you agree that your contributions will be licensed under the same license as this repository.
