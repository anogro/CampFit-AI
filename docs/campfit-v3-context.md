# CampFit v3 Context

## Product Goal

CampFit helps parents organize the conditions and preferences involved in choosing an overseas camp, then compares suitable experience directions, cities, and programs.

The product should feel like a natural consultation, not a rigid questionnaire.

## Active Experience

- Main route: `/campfit`
- Demo route: `/campfit?demo=1`
- v1 and v2 user interfaces are retired
- Existing backend recommendation and evaluation modules may remain in use

## Current Conversation Design

CampFit uses a conversation-first flow.

Facts have states such as:

- unknown
- tentative
- confirmed

Important facts include:

- child English level
- preferred activities
- expected change or experience
- peer interaction preference
- parent stay preference
- region interest
- special-care information

The application question planner owns the final next question.

## Current Provider State

OpenAI provider has successfully returned:

- HTTP 200
- schema-validated response
- `aiUsed=true`
- no fallback

A recent successful call completed in approximately 6.5 seconds with a 20-second configured timeout.

Provider connectivity is not the current primary blocker.

## Known Conversation Issue

The model `assistantMessage` may contain a question.

`conversationService` then appends the planner-owned question, producing two semantically duplicated questions.

Target behavior:

- short model acknowledgement
- one planner-owned question

## Known UI Issues

- Chat and typing avatars contain an unwanted central white circle.
- Result loading still contains a legacy `CF` icon.
- Result reasoning layout uses too much space.
- Defensive copy should be removed.
- Low-priority experience directions should not be displayed merely to fill the layout.
- Non-functional email CTA should be hidden.

## Known Recommendation Issue

In demo mode, recommendation cities and programs have appeared empty despite an existing demo catalog.

The issue must be traced through demo-mode persistence, catalog selection, filtering, API response, and result rendering.

Do not loosen hard filters until the actual elimination stage is identified.

## Duration Policy

- Presets: 1–4 weeks
- Custom duration allowed
- Minimum: 1 week
- Maximum: 12 weeks

## Representative Demo Scenario

- Child age: 8
- Departure: August 2026
- Duration: 3 weeks
- Budget: KRW 8–12 million
- Adults: 1
- Participating children: 1
- English: everyday conversation and English-led class participation
- Interests: robotics, science experiments, project outcomes
- Social preference: peer collaboration
- Parent: accompanying and remote work
- Region: undecided or Singapore/Auckland

This scenario should not produce a completely empty demo result.
