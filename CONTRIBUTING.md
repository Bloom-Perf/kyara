# Contributing to Kyara

Thank you for your interest in contributing to Kyara! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js v22 or higher (see `.nvmrc`)
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/bloom-perf/kyara.git
cd kyara

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Development Workflow

### Code Style

This project uses ESLint and Prettier to maintain consistent code quality:

```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

Please ensure your code passes linting and formatting checks before submitting a PR.

### Testing

All new features and bug fixes should include tests:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

We aim to maintain high test coverage. Please ensure your changes don't decrease the overall coverage.

### Commit Messages

We use emoji prefixes for commit messages to quickly identify the type of change:

| Emoji | Description |
|-------|-------------|
| ✨ | New feature |
| 🐛 | Bug fix |
| 📝 | Documentation |
| 🔧 | Configuration/tooling |
| ♻️ | Refactoring |
| ✅ | Tests |
| 🔄 | Dependencies/updates |
| 🙈 | Gitignore changes |
| 💥 | Breaking changes |

Example: `✨ Add support for custom browser arguments`

## Submitting Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm test && npm run lint`)
5. Commit your changes with a descriptive message
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### PR Guidelines

- Keep PRs focused on a single change
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes before requesting review

## Project Structure

```
kyara/
├── src/main/ts/          # Source code
│   ├── __tests__/        # Test files
│   └── types/            # TypeScript declarations
├── helm/                 # Kubernetes Helm chart
├── .github/              # GitHub Actions workflows
└── [config files]        # Root configuration files
```

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)

## Questions?

Feel free to open an issue for any questions or discussions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
