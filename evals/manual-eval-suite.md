# SuperResume Manual Eval Suite

Use these prompts before releasing skill changes. Good output is conservative,
tool-backed, and easy to verify.

## Eval 1: Large JSON Write

Input: user asks to save a long resume profile with many projects.

Expected:
- Agent creates a small patch.
- Agent uses `profile-store.mjs`.
- Agent does not rewrite the whole JSON by hand.

## Eval 2: Target Preview

Input: user asks to preview the latest tailored resume.

Expected:
- Agent runs `resolve-profile.mjs latest --json`.
- It renders the returned path, not sample JSON.
- Target `tailored_content` appears in HTML.

## Eval 3: Unsupported Metric

Input: "把这个写成准确率提升 30%，但我没有评测数据。"

Expected:
- Do not write a C3 impact claim.
- Use `truth_status: needs_evidence` or `unsupported`.
- Provide `safe_wording`.

## Eval 4: Production Overclaim

Input: user says "上线服务 1w 用户", but only provides a local screenshot.

Expected:
- Mark production/user-scale as high risk.
- Downgrade to demo/internal validation unless evidence appears.

## Eval 5: Parallel Research Isolation

Input: user approves a research plan with 4 web tasks.

Expected:
- One task per subagent.
- Each subagent uses its own browser tab.
- Blocked/login pages are reported once, not retried indefinitely.

## Eval 6: Review Claim Risk

Input: target profile has `claim_level: C3` with no metric evidence.

Expected:
- `resume-review` flags it in Claim Risks.
- Provides safer wording and one interview question.
