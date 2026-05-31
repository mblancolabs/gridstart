# Security Policy

Security is important for GridStart. Thank you for helping keep this project and its users safe.

This document explains how to report potential vulnerabilities and what to expect from maintainers.

## Supported Versions

GridStart is currently under active development. At this stage:

- Only the **latest commit on the default branch** is supported.
- No long-term support (LTS) branches are maintained yet.
- Security fixes will generally be released as part of normal development updates.

If you run a fork in production, you are responsible for backporting patches to your deployment.

## Reporting a Vulnerability

If you believe you have found a security vulnerability:

1. **Do not create a public GitHub issue** describing the vulnerability.
2. Open a **private security advisory** in the GitHub “Security”.

Please include:

- A short description of the issue.
- Steps to reproduce (proof of concept).
- Any relevant logs, screenshots, or test data.
- The environment where you reproduced it (OS, browser, Node version, etc.).
- Whether the issue has been disclosed publicly anywhere else.

If you are unsure whether something is a security issue, report it privately anyway and mention that you are not certain.

## What to Expect

After you report a vulnerability:

1. **Acknowledgment**  
   You should receive an acknowledgment confirming that the report was received.

2. **Initial Assessment**  
   The maintainer will evaluate the report, try to reproduce the issue, and assign a rough severity level (for example: low, medium, high, critical).

3. **Remediation Plan**  
   If the issue is confirmed:
   - A fix will be developed and tested.
   - Where appropriate, additional regression tests or hardening steps will be added.
   - The fix will be prepared for release as soon as reasonably possible.

4. **Coordinated Disclosure**  
   Once a fix is available:
   - The change will be released in a new version / commit.
   - The changelog and/or release notes will describe the impact in general terms.
   - You will be notified before or shortly after the public release.

If an issue is not considered a vulnerability (e.g., it is a configuration problem or a known limitation), this will be communicated back to you with an explanation.

## Scope

This security policy covers:

- The application code in this repository (frontend and backend).
- Default configuration as documented in `README.md` and environment examples.
- The way GridStart uses third-party libraries and services.

This policy does **not** cover:

- Third-party services you deploy GridStart on (e.g., cloud providers).
- Custom modifications or proprietary forks you maintain.
- Vulnerabilities in upstream APIs or ICS feeds themselves.

## Known Security Measures

GridStart already includes several security-related mechanisms:

- **Rate limiting** across key API endpoints to reduce abuse and protect availability.
- **CSRF protection** for state-changing requests.
- **Hardened error handling** to reduce information leakage through error messages and logs.
- Use of established middleware and libraries for HTTP security headers and CSRF controls.

These measures are continuously reviewed and may evolve over time.

## Responsible Disclosure

GridStart follows a **responsible disclosure** approach:

- Please give maintainers a reasonable amount of time to investigate and fix issues before discussing them publicly.
- Do not perform tests that could impact other users (e.g., DDoS, brute force against third-party services, or use of production data you do not own).
- Do not attempt to access data you are not authorized to access.

If you are interested in more formal recognition (hall of fame, acknowledgments, etc.), please mention this in your report. While there is currently no bug bounty program, good-faith reports are appreciated and may be credited in release notes where appropriate.

## Hardening Recommendations for Deployers

If you run GridStart yourself, you are encouraged to:

- Use supported, patched versions of Node.js and your operating system.
- Run behind HTTPS with modern TLS configuration.
- Configure appropriate reverse-proxy and firewall rules.
- Limit exposure of the backend only to trusted clients where possible.
- Regularly review dependencies for known vulnerabilities (e.g., via `npm audit` or GitHub security alerts).
- Keep environment secrets (API keys, database credentials) out of version control and logs.

If you discover a misconfiguration that results in a vulnerability, please report it following the process above.
