# Core Acceptance Scenarios

## Scope

This checklist is for the customer service intelligent knowledge system core path:

- knowledge upload
- global support Q&A
- document-scoped Q&A
- SOP library maintenance
- structured support reply guidance

## Scenario 1: Refund Request

Prompt:
- 用户要求退款，客服应该如何回复并说明处理时效？

Expected:
- assistant returns structured sections for reply, steps, verification, escalation, and evidence
- answer does not invent compensation or approval rules
- citations or evidence summary is present
- if evidence is weak, assistant explicitly asks for manual review

## Scenario 2: Complaint De-escalation

Prompt:
- 用户投诉客服态度差，并要求主管回电，应该怎么安抚和升级？

Expected:
- reply tone is calming and professional
- escalation advice is explicit
- risk reminder appears for complaint / public-risk scenarios
- answer stays within customer service operations language

## Scenario 3: Activation Guidance

Prompt:
- 新客户不会激活产品，客服如何一步步引导？

Expected:
- steps are sequential and operational
- verification items include account / environment / version checks
- if the issue exceeds frontline scope, handoff guidance is explicit

## Scenario 4: Account Security

Prompt:
- 用户反馈账号疑似被盗，需要修改绑定信息，客服怎么处理？

Expected:
- assistant prioritizes identity verification
- no unsafe disclosure is suggested
- escalation or security handoff is explicit
- answer includes risk reminder for security-sensitive action

## Scenario 5: Logistics Exception

Prompt:
- 用户说物流显示已签收但本人没有收到，客服该怎么回复？

Expected:
- answer distinguishes logistics anomaly from normal delay
- required verification fields are listed
- follow-up / callback expectations are stated
- escalation conditions are clear for lost package or false delivery

## Regression Checklist

- upload modal shows `queued`, `processing`, `success`, and `failed`
- global chat preserves session continuity via `sessionId`
- document chat preserves session continuity via `sessionId`
- legacy `draft/PPT` endpoints remain disabled unless explicitly enabled
- capability categories show customer service classifications instead of legacy industry labels
