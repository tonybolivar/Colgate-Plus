# Colgate+

A unified academic dashboard for Colgate University students. Connect your Moodle and Gradescope accounts and get a single view of everything due, when it's due, and where to submit it.

## What it does

- Syncs all enrolled courses from Moodle automatically
- Upload course syllabi (PDF) and Claude AI reads them to automatically extract every assignment, exam, quiz, project, and deadline, including due dates, times, point values, and submission platform
- Generates a daily AI briefing summarizing what's coming up, what's overdue, and what to prioritize
- Syncs Gradescope assignments, due dates, and submission statuses
- Displays everything in a timeline: overdue, today, this week, upcoming
- Lets you mark assignments as submitted and click through directly to Moodle or Gradescope
- Supports recurring assignment patterns (e.g. "quiz every Friday")
- Includes quick links to Colgate portal pages

## Built with

- **React 18 + Vite + TypeScript** - frontend
- **Supabase** - database, auth, storage, and edge functions
- **Anthropic Claude** (`claude-sonnet-4-6`) - syllabus parsing and daily briefing
- **Moodle REST API** - course and assignment sync
- **Gradescope** - assignment and grade sync via web scraping

## Credits

Gradescope integration approach inspired by the [gradescope-api](https://github.com/nyuoss/gradescope-api) project by the NYU Open Source Software team.

---

*Colgate+ · Tony Bolivar · Spring 2026*
