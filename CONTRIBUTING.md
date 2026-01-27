# Contributing to StockIQ

First off, thank you for considering contributing to StockIQ! It's people like you that make StockIQ such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs** if possible

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the TypeScript styleguide
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Follow conventional commits:
  * `feat:` New feature
  * `fix:` Bug fix
  * `docs:` Documentation only changes
  * `style:` Changes that do not affect the meaning of the code
  * `refactor:` Code change that neither fixes a bug nor adds a feature
  * `perf:` Code change that improves performance
  * `test:` Adding missing tests or correcting existing tests
  * `chore:` Changes to the build process or auxiliary tools

### TypeScript Styleguide

* Use TypeScript for all new code
* Prefer interfaces over type aliases
* Use explicit return types for functions
* Use `const` for all variables that are not reassigned
* Use meaningful variable names
* Add JSDoc comments for public APIs

### Testing

* Write tests for all new features
* Maintain or improve code coverage
* Use descriptive test names
* Follow AAA pattern (Arrange, Act, Assert)

## Project Structure

```
stockiq/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Base UI components
│   └── features/          # Feature-specific components
├── lib/                   # Business logic
│   ├── providers/         # Data provider implementations
│   ├── ai/               # AI-related services
│   └── db/               # Database utilities
├── hooks/                 # Custom React hooks
├── stores/                # State management
└── types/                 # TypeScript type definitions
```

## Setting Up Development Environment

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Run development server:
```bash
pnpm dev
```

4. Run tests:
```bash
pnpm test
```

## Questions?

Feel free to open an issue with your question or contact the maintainers directly.

Thank you for contributing! 🎉