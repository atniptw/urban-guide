# Contributing to aiflow

Thank you for your interest in contributing to aiflow! This document provides guidelines and instructions for contributing to the project.

## Pull Request Process

### Quality Gates

All pull requests must pass automated quality checks before they can be merged:

1. **TypeScript Compilation** - Code must compile without errors
2. **ESLint** - No linting errors (warnings are allowed but should be minimized)
3. **Prettier** - All code must be properly formatted
4. **Tests** - All tests must pass
5. **Coverage** - Code coverage must meet minimum thresholds:
   - Global: 90% statements, 90% functions, 90% lines, 80% branches
   - Core modules (`src/core/`): 90% all metrics (when implemented)
   - Agent modules (`src/agents/`): 90% all metrics (when implemented)
6. **Build** - Production build must complete successfully

### Before Submitting a PR

Run these commands locally to ensure your changes will pass CI:

```bash
# Run all quality checks
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:coverage
npm run build
```

To automatically fix formatting issues:
```bash
npm run format
```

To automatically fix some linting issues:
```bash
npm run lint:fix
```

### PR Workflow

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure all tests pass and coverage is maintained
5. Submit a pull request to the `main` branch
6. Wait for automated checks to complete
7. Address any feedback from reviewers

### Automated PR Checks

The GitHub Actions workflow will:
- Install dependencies with `npm ci`
- Run TypeScript compilation check
- Execute ESLint validation
- Check Prettier formatting
- Run the full test suite with coverage
- Generate and comment coverage report on the PR
- Validate the production build
- Check bundle size constraints

### Coverage Reports

Each PR will receive an automated comment with:
- Coverage percentages for lines, statements, functions, and branches
- Indication of whether coverage thresholds are met
- Links to detailed coverage reports (available as artifacts)

## Development Guidelines

### Code Style

- TypeScript strict mode is enabled - ensure your code passes type checking
- Follow the ESLint configuration in `.eslintrc.js`
- Use Prettier for consistent formatting
- Write tests for new functionality
- Maintain or improve code coverage

### Testing

- Write unit tests for all new code
- Place test files next to the code they test (e.g., `index.test.ts` next to `index.ts`)
- Use Jest for testing
- Mock external dependencies appropriately
- Aim for high code coverage but prioritize meaningful tests

### Commit Messages

Follow conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test additions/changes
- `refactor:` for code refactoring
- `chore:` for maintenance tasks

### Documentation

- Update relevant documentation when making changes
- Add JSDoc comments for public APIs
- Keep the README up to date
- Document breaking changes clearly

## Getting Help

If you need help or have questions:
1. Check existing issues and PRs
2. Read the documentation in `/docs`
3. Open a discussion or issue for clarification

## License

By contributing to aiflow, you agree that your contributions will be licensed under the MIT License.