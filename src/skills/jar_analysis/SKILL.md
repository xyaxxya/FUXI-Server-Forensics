# Jar Analysis Skill

## Description
This skill extracts a JAR file and searches for sensitive configuration files (e.g., database configs, API keys) without relying on `strings` or decompilation. It provides a structured view of the findings.

## Usage
When the user asks to analyze a JAR file or when a JAR file is identified in a Java web application context, use the `analyze_jar_config` tool.

## Rules
1. **DO NOT** use `strings` command on JAR files.
2. **ALWAYS** use `analyze_jar_config` as the first step for JAR analysis.
3. Review the extracted configuration files for credentials, URLs, and internal endpoints.
