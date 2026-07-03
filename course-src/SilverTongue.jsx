import { useState, useEffect, useCallback } from "react";

/* ————————————————————————————————————————————————
   THE SILVER TONGUE — an 8-week course by sdp
   Say the true thing in the language they can hear.
   ———————————————————————————————————————————————— */

export const T = {
  canvas: "transparent",
  paper: "#e0e0e0",
  ink: "#222222",
  muted: "#555555",
  line: "#888888",
  accent: "#111111",
  accentSoft: "#cfcfcf",
  serif: "'VT323', 'IBM Plex Mono', 'Monaco', 'Menlo', 'Consolas', 'Chicago', 'Geneva', 'Arial', monospace",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/* ———————————— THE SEVEN (one read, six moves) ———————————— */

const MOVES = [
  {
    name: "The Governing Read",
    tag: "the read that steers everything",
    body: "Before you open your mouth, answer one question: does this room need me to be the expert, or the ally? Every other move points a different direction depending on this answer. A COO who came up from the factory floor needs an ally. An interview panel needs an expert. Get this read wrong and executing every other move perfectly will still lose the room.",
  },
  {
    name: "Status Posture",
    tag: "counter the room, don't mirror it",
    body: "When the room is tense, most people instinctively mirror the tension — crossed arms meet crossed arms. Instead, calibrate opposite: calm against cold, energy against flat. Lean back but sit up straight. The body speaks before the mouth does.",
  },
  {
    name: "Status Currency",
    tag: "concede or assert — the read decides",
    body: "Ally rooms reward concession: 'I won't pretend to know your process like you do.' Expert rooms reward assertion: claim the ground, hold it. Same move, opposite directions. This is not a fixed behavior — it is a dial, and the Governing Read sets it.",
  },
  {
    name: "Borrowed Authority",
    tag: "let the pattern speak when you can't",
    body: "When your personal standing is thin, borrow weight from outside yourself: 'across the industry, we're hearing the same issues,' a checkable statistic, a framework like Maslow. When the read says expert, do the opposite — speak from your own scar tissue, not someone else's citation.",
  },
  {
    name: "Translate, Don't Parrot",
    tag: "their world, your words",
    body: "Convert the other person's world into your own plain language — never repeat their literal vocabulary back at them. Mimicry works only below the level of conscious detection, and words are the one channel people always consciously notice. 'Lugging things back and forth' lands. Their own catchphrase quoted back reads as strategy, not connection.",
  },
  {
    name: "Theory, Then Image",
    tag: "one vivid picture per abstract point",
    body: "Every abstract claim earns one concrete, slightly funny physical image. 'Seniors are treated as consumers, not producers' — then: 'how much golf is a 70-year-old actually going to play?' The theory convinces the mind; the image is what they repeat to their spouse at dinner.",
  },
  {
    name: "Question Upgrading",
    tag: "answer the truer question",
    body: "Under a hard question, answer the deeper question the person is really asking. 'What will you tell my plant managers?' is really 'why should I trust you?' Use with care: a sharp questioner notices the dodge, so keep a real answer to the literal question in your pocket too.",
  },
];

/* ———————————— THE EIGHT WEEKS ———————————— */

const WEEKS = [
  {
    n: 1,
    title: "The Line & The Triangle",
    thesis: "What a silver tongue is — and the ethical line that keeps it honest.",
    framework: [
      "Most people speak in one register and hope it lands. A silver tongue is a frequency-matching radio, not a fixed broadcast: the same true message, tuned so it can actually be received.",
      "That word — true — is the line. Manipulation changes the content of truth to win. This craft changes the packaging of truth to be understood. You translate; you never bend. Trainees drift toward the easy version (say what they want to hear) unless anchored to the harder one (say the true thing in the language they can hear it in).",
      "Underneath every persuasive moment sits one silent question the other person is asking: why should I trust you? Humans have been debating how to answer that question for thousands of years. About 2,400 years ago, the Greek philosopher Aristotle wrote a treatise called Rhetoric, laying out a framework for persuasion that's still taught today — usually drawn as a triangle.",
      "Logos sits at the bottom point — the logic and evidence that give an argument something to stand on. Pathos and ethos sit at the top two corners: pathos is the emotional pull, ethos is the credibility of the person making the case. All three have to show up, or the triangle collapses.",
      "Translate that into today's world and it still holds. In a data-driven world, being analytical is what drives trust — without facts and substance, people can't tell if you're telling the truth. That's logos. Then there's empathy, which is pathos, and authenticity, which is ethos. In sales especially, the soft skills matter as much as the substance: you have to actually be yourself, and read the person in front of you.",
    ],
    diagram: "trustTriangle",
    diagramAfter: 2,
    example: {
      what: "Watch \"How to use rhetoric to get what you want\" — a short TED-Ed lesson by Camille Langston that walks through Aristotle's three appeals directly.",
      watchFor: "Notice that none of the three appeals works alone in her examples — it's always a combination, weighted differently depending on the audience.",
      link: "https://www.youtube.com/watch?v=3klMM9BkW5o",
    },
    caseStudy: null,
    reflection: "This week, catch one moment where you almost said something other than what you meant in order to be liked. Don't fix it — just notice the pull. The line between translating and bending only becomes visible once you've felt it.",
  },
  {
    n: 2,
    title: "The Governing Read",
    thesis: "Expert or ally? One read, made before you speak, that sets the direction of everything else.",
    framework: [
      "Here is the load-bearing insight of the entire course: the moves are not fixed behaviors, they are dials — and one read sets them all. Before speaking, silently answer: does this room need me to be the expert, or the ally?",
      "Denise, thirty years the expert in her own building, needed an ally — coming in as the expert triggered the crossed arms. A hiring panel at a top firm is the opposite: the meeting is a credibility test, and conceding status there reads as weakness, not humility. Same person, same skills, opposite settings on the dial.",
      "Get the read right and average execution still works. Get it wrong and perfect execution fails. That ratio is why this is week two, not week seven.",
    ],
    example: {
      what: "Watch Barack Obama fielding a hostile question at a town hall — any of his healthcare town halls from 2009–2010 work well.",
      watchFor: "He almost never claims expert status with a skeptical crowd. He concedes something real ('you're right to be frustrated'), physically stills himself, then earns the room back as an ally before making any claim. Count the seconds between the concession and the first counter-argument. It's longer than you'd guess.",
      link: "https://www.youtube.com/results?search_query=obama+town+hall+hostile+question+healthcare",
    },
    caseStudy: {
      setup: "Two rooms, one week apart. Room A: Denise's conference room (week 1). Room B: a final-round interview at a top consulting firm, three partners, one hour.",
      prompt: "For each room, write one opening sentence answering the question 'why should we listen to you?' — then note which dial position (expert / ally) you chose and why. The sentences should be nearly opposite in posture.",
      debrief: [
        "Room A rewards: 'I won't pretend to know your floor — but across the industry we're hearing the same three issues.' Concede, then borrow authority.",
        "Room B rewards: 'I've done this before, and here's the scar tissue to prove it.' Assert, and speak from personal experience — borrowed frameworks read as hiding in an expert room.",
        "If your two sentences could be swapped between rooms without damage, the read isn't driving your language yet. Redo until swapping them would clearly fail.",
      ],
    },
    reflection: "Before your next three conversations of any weight, silently guess: expert or ally? Don't change anything yet — just make the read and check it against how the conversation goes. You're calibrating the instrument before flying with it.",
  },
  {
    n: 3,
    title: "Reading People Fast",
    thesis: "A four-quadrant diagnostic for how someone wants to be spoken to — usable in the first 30 seconds.",
    framework: [
      "You can't tune the radio without finding the frequency. The research on communication styles keeps converging on the same number: four buckets, not twelve. More than four and no one can sort in real time.",
      "Two axes. Assertiveness: do they tell or ask? Responsiveness: do they lead with task or with people? That gives four styles — Drivers (tell + task: give them the bottom line first), Analyticals (ask + task: give them the data and don't rush), Amiables (ask + people: earn trust before content), Expressives (tell + people: match energy, headline the vision).",
      "The tells arrive fast: sentence length, whether they interrupt, whether their first question is about numbers or about people, what's on their desk. Denise — short sentences, 'say it in English,' arms crossed, leaned in at floor experience — reads Driver with an Amiable trigger: respect earned through the floor, not the deck.",
    ],
    example: {
      what: "This week the example is field observation. Pick two meetings or calls and, in the first two minutes, sort each speaker into a quadrant.",
      watchFor: "First tell: do they open with a question or a statement? Second: is the question about the work or about you? Two data points usually place someone within one quadrant's margin of error.",
      link: null,
    },
    caseStudy: {
      setup: "Cold read. You're meeting Marcus, CFO of a logistics company, for the first time — a warm intro from a mutual contact. He joins the call two minutes late, no apology, camera on, blank wall behind him. First words: 'I've got 25 minutes. My colleague said you had something on cost recovery — walk me through the mechanics and the fee structure.'",
      prompt: "Quadrant? And write your first two sentences in response — tuned to that quadrant.",
      debrief: [
        "Marcus is a Driver bordering Analytical: telling, task-first, wants mechanics and fees, gave you a clock. The mention of 'mechanics' tilts Analytical — he wants how it works, not just what he gets.",
        "Tuned open: bottom line in sentence one ('Cities recover tax revenue they're already owed; we take a contingency fee only when they collect'), mechanics in sentence two. No biography, no warm-up — with Drivers, rapport is earned by respecting the clock.",
        "The trap: opening with your credentials. That's Expressive-register speech aimed at a Driver — it costs you the first 90 seconds, which with a Driver may be the whole meeting.",
      ],
    },
    reflection: "Once this week, notice a physical shift in someone mid-conversation — arms crossing, a lean-in, a glance at a phone. Then notice what you did next. Not what you should have done. Just build the loop: shift, noticed, responded.",
  },
  {
    n: 4,
    title: "Borrowed Authority",
    thesis: "When to let a framework, a stat, or the industry speak — and when speaking for yourself is the only thing that works.",
    framework: [
      "There are two sources of credibility: what you've personally earned, and what you can borrow. Borrowed authority is reaching outside yourself for weight — 'across the industry,' a Maslow, a checkable number. It shines exactly where personal authority is thin: you can't out-expert Denise on her own floor, but you can bring her the pattern from fifty other floors.",
      "One rule for what to borrow: checkable beats impressive. A number the listener could verify in ten seconds ('seniors hold the largest share of US household wealth') builds more trust than a dazzling claim they can't check — because the act of checkability is itself a trust signal.",
      "The dial, again: in an expert room, borrowing reads as hiding. A partner interviewing you wants your scar tissue, not your citations. The Governing Read decides which source of credibility you draw on — this move has no fixed setting.",
    ],
    example: {
      what: "Re-read your own last pitch or memo and highlight every claim in two colors: personally earned vs. borrowed.",
      watchFor: "Most drafts cluster at one extreme. All-borrowed reads as a book report; all-personal reads as ego. The strong ratio shifts with the room — but a pitch to strangers usually wants borrowed structure carrying personally earned insight at the key moment.",
      link: null,
    },
    caseStudy: {
      setup: "The Sequoia redo. Second-round with a growth-stage partner. You know from research: Wharton, six years McKinsey, and a podcast last month where she twice used the phrase 'conviction over consensus' as her investing philosophy. She opens: 'I read your deck. Walk me through your conviction on this market — not the consensus view, your view.'",
      prompt: "Deliver your answer aloud. Constraints: at least one borrowed-authority element (framework or checkable stat), at least one personally earned element, and do not use her phrase or any close variant.",
      debrief: [
        "The borrowed layer gives the argument a spine a McKinsey-trained listener will recognize (a hierarchy, a market number she can check).",
        "The personal layer is what she actually asked for — conviction is by definition yours. If everything in your answer could appear in a research report, you answered a different question.",
        "The phrase ban is the point: you demonstrate you speak her language by structuring the answer as conviction — not by quoting her vocabulary back. Alignment shown, never announced.",
      ],
    },
    reflection: "Track it for a week: each time you make a claim of any weight, notice whether you cited something or asserted from experience. No judgment — just tally. Most people discover they have a strong default, and the default is invisible until counted.",
  },
  {
    n: 5,
    title: "Translate, Don't Parrot",
    thesis: "The failure mode that looks like the skill: why mirroring language backfires exactly when it's most tempting.",
    framework: [
      "Mimicry research has a sharp edge that most 'rapport' advice misses: matching works only below the level of conscious detection. Posture, pace, energy — people don't consciously register those, so matching them builds connection. Words are different. Everyone is exquisitely sensitive to their own specific phrases coming back at them. Lexical mirroring is the one channel where the other person is most likely to catch you — and the moment the effort is visible, it reads as strategy, not connection.",
      "A good translator makes you forget you're reading a translation. A bad one keeps showing you the dictionary. The craft is converting their world into your own natural register: they say 'workflow friction,' you say 'nobody wants to lug something back and forth.' Their meaning, your words.",
      "This failure mode is seductive precisely because it feels like diligence — you researched them, you learned their language, using it feels like homework paying off. That is exactly the moment to translate instead.",
    ],
    example: {
      what: "Watch Zohran Mamdani handling a hostile or loaded press question — his 2025 NYC campaign press interactions have many examples.",
      watchFor: "He rarely accepts the questioner's framing vocabulary. He restates the question's substance in his own plainer words — often warmer than the question deserved — and answers the restated version. The reframe is the move; count how many of the reporter's loaded words survive into his answer. Usually near zero.",
      link: "https://www.youtube.com/results?search_query=mamdani+press+conference+tough+question",
    },
    caseStudy: {
      setup: "The dissection. A real failure: a Sequoia interview, heavily researched. The candidate matched the partner's tone and used the partner's own recurring phrases back at him. Verdict afterward: 'performative and salesy.' Every individual choice was defensible — research, tailoring, alignment. The sum read as manufactured.",
      prompt: "Diagnose it: name the exact seam where reading someone crossed into mirroring them. Then rewrite one line of that pitch two ways — a parroted version and a translated version — and say aloud what makes them land differently.",
      debrief: [
        "The seam: behavioral matching (energy, structure, pacing) stayed invisible and worked; lexical matching (his phrases) crossed the conscious-detection line and collapsed everything built beneath it.",
        "The translated version carries the same alignment content — same values, same structure — with none of the fingerprints. Alignment is demonstrated by how you think, not by which words you borrow.",
        "Rule of thumb for the pocket: match the music, never the lyrics.",
      ],
    },
    reflection: "Catch yourself once this week about to repeat someone's exact phrase back to them — in a meeting, a reply, a text. Stop, and translate it into your own words instead. Notice whether the conversation even registers the difference. (It will — just not consciously.)",
  },
  {
    n: 6,
    title: "The Written Register",
    thesis: "The same craft with no body, no tone, no timing — only word choice. Three rules carry all of it.",
    framework: [
      "In writing you lose every channel except the words, which is why email is the purest test of translation. Three rules carry the entire discipline. One: assume your reader is lazy — shorter and cleaner always wins, and if a fifth grader couldn't follow a sentence, it's too complex. Two: people only care about themselves — open with what's in it for them, never with who you are. Three: social capital is everything — names, institutions, and mutuals are load-bearing, so put them where they'll be seen, starting with the subject line.",
      "The order of operations most cold emails get backwards: the ask goes early ('Would you, or someone on your team, be open to a 15-minute Zoom?'), because a lazy reader decides in the first two lines whether this email costs them anything. Burying the ask forces them to read everything just to find out what you want — which they won't.",
      "Boilerplate is the written version of 'leveraging synergies.' 'Administrative efficiency' is a phrase nobody has ever said out loud. Write the way you'd explain it across a table.",
    ],
    example: {
      what: "The worked example is real: a mentee's cold outreach for a municipal-revenue startup, with sdp's inline comments. Three templates — finance director, academic, procurement — that turned out to differ only in scattered word choice.",
      watchFor: "Nearly every inline comment is one of the three rules applied to a specific line: 'why would the reader care after this sentence?' (rule 2), 'would a lazy person read this?' (rule 1), 'nowhere do we say our team includes Rhodes and Marshall Scholars' (rule 3). The rules are few; the applications are endless.",
      link: null,
    },
    caseStudy: {
      setup: "Take a real cold email you'd plausibly send — or draft one for this scenario: you want 15 minutes with a city finance director to pitch a no-upfront-cost tax-recovery service.",
      prompt: "Write it. Then audit your own draft with the three rules as comments in the margin, the way an editor would: for each sentence, which rule does it serve — and if none, why is it there?",
      debrief: [
        "Strong drafts: ask in the first two lines, one sentence of what-they-get before any who-we-are, social capital compressed into the subject line and one credentials line.",
        "The most common failure is a first sentence about yourself. Flip it: their problem, their upside, then you.",
        "If three versions of your email for three audiences differ only in scattered words, you haven't actually re-read the audience — you've re-skinned the template. Different reader, different opening logic.",
      ],
    },
    reflection: "Once this week, take an email you'd normally fire off in two minutes and give it the lazy-reader edit: cut a third of the words without losing the ask. Clock how long the edit takes. The number usually surprises people — and it drops fast with reps.",
  },
  {
    n: 7,
    title: "Story as Structure",
    thesis: "Tension and release on a clock: STAR with weighted timing, and the image that makes a story portable.",
    framework: [
      "A story is an argument the listener doesn't resist. The structure underneath any good spoken answer: context that orients them, insight that's new to them, implication that makes it matter. Compressed into a 60-second behavioral answer, that becomes STAR with load-bearing weights: Situation 40%, Task 10%, Action 30%, Result 20%. The 40 surprises people — but the situation is where tension is built, and tension is what makes the listener root for you. Skip it and the action lands flat.",
      "The best speakers win three silent yeses early: do I like this person, do I care what they're saying, might I learn something? Passion and personality earn the first; structure earns the second; the insight earns the third.",
      "Then make it portable: one concrete image per story that survives retelling. Not 'we fundraised creatively' — a stationary bike in the rain at midnight with a sign reading 'donate for a good cause (also I get a break).' The listener will forget your verbs. They will not forget the bike.",
    ],
    example: {
      what: "The model story: Engineers Without Borders needed $10,000 that didn't exist — crowdfunding exhausted, school funds tapped, external money banned by the org. The team put a stationary bike in Princeton's heaviest foot traffic and biked for 72 hours straight, someone always on it, midnight, rain, whenever. Raised $7,500 — not the whole goal, but enough to cut costs elsewhere and dig the well.",
      watchFor: "Map the weights: the impossible-constraints setup is the 40 (crowdfunded, tapped, banned — 'so… how?'). The bike is the 30. The 7,500 with honest framing — 'it wasn't the whole goal' — is the 20, and the honesty is doing trust work. The sign is the image that survives retelling.",
      link: null,
    },
    caseStudy: {
      setup: "Build your own. Pick a real experience that answers 'tell me about a big problem you solved.'",
      prompt: "Write it to the weights — 40/10/30/20 of a 60-second clock. Then deliver it out loud, standing, 10–12 times across the week, recording at least twice. Listen for whether your tone builds tension in the 40 or just recites facts.",
      debrief: [
        "The out-loud reps are not optional polish — they're the mechanism. Hearing your own voice is how content, words, and tone get memorized together; reading silently trains none of that.",
        "Check for the image: if a friend heard your story once, what's the one physical thing they'd repeat at dinner? If you can't name it, the story doesn't have one yet.",
        "Honest results outperform inflated ones. 'It wasn't the whole goal, but—' buys more trust than a suspiciously round triumph.",
      ],
    },
    reflection: "Once this week, notice a moment of real tension — a plan breaking, a constraint with no obvious exit — and write down only the tension, one sentence, in a running note. You're not writing stories yet. You're building the inventory great stories get drawn from.",
  },
  {
    n: 8,
    title: "Holding Frame",
    thesis: "Capstone: hard questions, live, cold — every move at once, under the pressure that makes them instinct.",
    framework: [
      "The final move is what separates composure from evasion: under a hard question, answer the truer question beneath it — while making the questioner feel heard, not dodged. 'What will you tell my plant managers?' is really 'why should I trust you?' Upgrading the question is powerful and risky in equal measure: done warmly, it reads as depth; done visibly, a sharp questioner will simply re-ask, and now you've spent trust.",
      "So the complete form is: acknowledge the literal question, answer the truer one, and keep a real answer to the literal one loaded for the follow-up. The masters make the person who asked the hostile question feel like the most respected person in the room.",
      "This week is drilling, not reading. Instinct is built the way it was built the first time — thousands of small reps until the pattern-matching runs without you. A checklist can't be handed over; a rep count can.",
    ],
    example: {
      what: "Two studies in holding frame under fire: Obama taking directly hostile questions (the 2010 House Republican retreat Q&A is a masterclass), and Mamdani in adversarial press exchanges.",
      watchFor: "Both do the same three things in different styles: name the emotion or stake in the question ('I know folks are angry about this'), reframe in their own vocabulary, answer the upgraded question with one concrete image. Neither ever speeds up. Pace is the tell of frame — the person who accelerates has lost it.",
      link: "https://www.youtube.com/results?search_query=obama+house+republican+retreat+2010+q%26a",
    },
    caseStudy: {
      setup: "Capstone, cold, no prep time. You're 20 minutes into a seed pitch with an angel investor — a former operator who built and sold a senior-care company, so this is her turf. She's been quiet, taking notes. She caps her pen and says: 'I've watched a dozen founders pitch me the seniors market with the same Maslow slide. Most of them had never spent a day with an actual 75-year-old. Why is this real for you — and don't give me the market size.'",
      prompt: "Answer aloud, unrehearsed. Then self-score against the full inventory: What was your governing read? What did your posture do? Did you concede or assert — and did the read justify it? Personal or borrowed authority — she banned one of them; did you notice? Did any of her vocabulary survive into your answer? Where was your image? Which question did you actually answer?",
      debrief: [
        "She explicitly banned borrowed authority ('don't give me the market size,' 'the same Maslow slide') — this is an expert-to-expert room demanding personally earned credibility only. If a framework appeared in your answer, the read was missed.",
        "The truer question under hers: 'are you one of the tourists?' The winning answer is a specific, sensory, personal moment with a real senior — theory, then image, with the theory nearly silent.",
        "Score honestly, then re-run the scenario once more at week's end. The gap between run one and run two is your proof that this is trainable — you are the evidence.",
      ],
    },
    reflection: "Full retrospective: for each of the seven moves, mark it instinct (runs without thought), conscious (works when you remember), or missing. The conscious column is next month's curriculum. Then the last question, the one that keeps the whole craft honest: in the last eight weeks, did you ever bend the truth instead of translating it — and what did it cost?",
  },
];

/* ———————————— STORAGE ———————————— */

const SKEY = "silver_tongue_state_v1";

async function loadState() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(SKEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) { /* first visit or unavailable */ }
  return null;
}

async function saveState(state) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(SKEY, JSON.stringify(state));
    }
  } catch (e) { /* non-fatal */ }
}

/* ———————————— UI PRIMITIVES ———————————— */

function Label({ children, style }) {
  return (
    <div style={{
      fontFamily: T.serif, fontSize: 11, letterSpacing: "0.22em",
      textTransform: "uppercase", color: T.muted, ...style,
    }}>{children}</div>
  );
}

function Rule({ style }) {
  return <div style={{ height: 1, background: T.line, ...style }} />;
}

function Btn({ children, onClick, primary, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: T.serif, fontSize: 15, cursor: disabled ? "default" : "pointer",
        padding: "10px 22px", borderRadius: 2,
        border: `1px solid ${primary ? T.accent : T.line}`,
        background: primary ? T.accent : "transparent",
        color: primary ? T.paper : T.ink,
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 160ms ease",
        ...style,
      }}
    >{children}</button>
  );
}

/* ———————————— ONBOARDING ———————————— */

const HOW_IT_WORKS = [
  {
    title: "Eight chapters, in order",
  },
  {
    title: "Four parts per chapter",
    list: ["Theoretical framework", "Worked example", "Case study", "Reflection"],
  },
  {
    title: "Your pace, saved as you go",
    body: "Mark a chapter complete when you're ready. Come back anytime — your progress is saved right here in this browser.",
  },
];

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState(0); // 0 name, 1 how it works

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 24px", textAlign: "center" }}>
      <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 46, margin: "0 0 14px", color: T.ink, letterSpacing: "-0.01em" }}>
        The Silver Tongue
      </h1>
      <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 18, color: T.muted, margin: "0 0 48px" }}>
        How do you speak so that people listen?
      </p>

      {stage === 0 && (
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) setStage(1); }}
            placeholder="Your name"
            style={{
              fontFamily: T.serif, fontSize: 18, padding: "12px 16px", width: 280,
              border: `1px solid ${T.line}`, borderRadius: 2, background: T.paper,
              color: T.ink, textAlign: "center", outline: "none",
            }}
          />
          <div style={{ marginTop: 28 }}>
            <Btn primary disabled={!name.trim()} onClick={() => setStage(1)}>Begin</Btn>
          </div>
        </div>
      )}

      {stage === 1 && (
        <div>
          <p style={{ fontFamily: T.serif, fontSize: 17, color: T.ink, lineHeight: 1.65, marginBottom: 36 }}>
            Here's how this works, {name.trim()}.
          </p>
          <div style={{ textAlign: "left", maxWidth: 440, margin: "0 auto" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} style={{ display: "flex", gap: 18, marginBottom: 28 }}>
                <div style={{
                  width: 32, minWidth: 32, height: 32, borderRadius: "50%",
                  border: `1px solid ${T.line}`, background: T.paper, color: T.ink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: T.serif, fontSize: 15,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink }}>{step.title}</div>
                  {step.body && (
                    <div style={{ fontFamily: T.serif, fontSize: 15, color: T.muted, marginTop: 4, lineHeight: 1.55 }}>
                      {step.body}
                    </div>
                  )}
                  {step.list && (
                    <ol style={{ fontFamily: T.serif, fontSize: 15, color: T.muted, marginTop: 4, lineHeight: 1.55, paddingLeft: 18 }}>
                      {step.list.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn primary onClick={() => onDone(name.trim(), null)}>Enter the course</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ———————————— THE MAP ———————————— */

function MapView({ state, onOpenWeek, onOpenMoves }) {
  const done = state.completed || [];
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 96px" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Label style={{ marginBottom: 14 }}>The course of study</Label>
        <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 34, margin: 0, color: T.ink }}>
          Eight Chapters
        </h1>
        <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 15.5, color: T.muted, marginTop: 10 }}>
          {done.length === 0
            ? `Welcome, ${state.name || "friend"}.`
            : done.length === 8
            ? "All eight complete. The reflection column is next month's curriculum."
            : `${done.length} of 8 complete. The week between chapters is where the instinct gets built.`}
        </p>
        <div style={{ marginTop: 18 }}>
          <button disabled style={{
            fontFamily: T.serif, fontSize: 13.5, letterSpacing: "0.14em", textTransform: "uppercase",
            background: "none", border: "none", borderBottom: `1px solid ${T.line}`,
            color: T.line, cursor: "default", padding: "2px 1px",
          }}>The Seven Moves — reference</button>
        </div>
      </div>

      {/* the spine */}
      <div style={{ position: "relative", marginTop: 44 }}>
        <div style={{
          position: "absolute", left: 27, top: 12, bottom: 12, width: 1, background: T.line,
        }} />
        {WEEKS.map((w) => {
          const isDone = done.includes(w.n);
          const locked = w.n !== 1;
          return (
            <div
              key={w.n}
              onClick={() => !locked && onOpenWeek(w.n)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 22,
                padding: "18px 14px", cursor: locked ? "default" : "pointer", position: "relative",
                borderRadius: 3, opacity: locked ? 0.4 : 1,
              }}
              onMouseEnter={(e) => !locked && (e.currentTarget.style.background = T.paper)}
              onMouseLeave={(e) => !locked && (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 54, minWidth: 54, height: 54, borderRadius: "50%",
                border: `1px solid ${isDone ? T.accent : T.line}`,
                background: isDone ? T.accent : T.paper,
                color: isDone ? T.paper : T.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: T.serif, fontSize: 17, zIndex: 1,
              }}>
                {ROMAN[w.n - 1]}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontFamily: T.serif, fontSize: 20, color: T.ink }}>
                  {w.title}
                  {isDone && <span style={{ color: T.accent, fontSize: 14, marginLeft: 10 }}>✓ complete</span>}
                </div>
                <div style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 14.5, color: T.muted, marginTop: 4, lineHeight: 1.55 }}>
                  {w.thesis}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ———————————— MOVES REFERENCE ———————————— */

function MovesView({ onBack }) {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 96px" }}>
      <button onClick={onBack} style={{
        fontFamily: T.serif, fontSize: 14, background: "none", border: "none",
        color: T.muted, cursor: "pointer", padding: 0, marginBottom: 34,
      }}>← Back to the map</button>
      <Label style={{ marginBottom: 12 }}>Reference</Label>
      <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 32, margin: "0 0 8px", color: T.ink }}>
        The Seven Moves
      </h1>
      <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 15.5, color: T.muted, lineHeight: 1.6, marginBottom: 40 }}>
        One governing read, six moves beneath it. None are fixed behaviors — each is a dial, and the read sets the direction.
      </p>
      {MOVES.map((m, i) => (
        <div key={m.name} style={{ marginBottom: 34 }}>
          <div style={{ display: "flex", baselineAlign: "baseline", gap: 12, alignItems: "baseline" }}>
            <span style={{ fontFamily: T.serif, fontSize: 14, color: T.accent }}>{i === 0 ? "☉" : i}</span>
            <span style={{ fontFamily: T.serif, fontSize: 20, color: T.ink }}>{m.name}</span>
            <span style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 13.5, color: T.muted }}>{m.tag}</span>
          </div>
          <p style={{ fontFamily: T.serif, fontSize: 15.5, color: T.ink, lineHeight: 1.7, margin: "10px 0 0 26px" }}>
            {m.body}
          </p>
          {i < MOVES.length - 1 && <Rule style={{ marginTop: 30 }} />}
        </div>
      ))}
    </div>
  );
}

/* ———————————— WEEK VIEW ———————————— */

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 52 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Label>{label}</Label>
        <Rule style={{ flex: 1 }} />
      </div>
      {children}
    </div>
  );
}

function P({ children, italic, style }) {
  return (
    <p style={{
      fontFamily: T.serif, fontSize: 16.5, lineHeight: 1.75, color: T.ink,
      fontStyle: italic ? "italic" : "normal", margin: "0 0 16px", ...style,
    }}>{children}</p>
  );
}

function TrustTriangleDiagram() {
  const dot = { fill: T.ink };
  const label = {
    fontFamily: T.serif, fontSize: 12, letterSpacing: "2px",
    fill: T.muted,
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 28px" }}>
      <svg viewBox="0 0 300 230" width={270} height={207}>
        <polygon points="45,35 255,35 150,195" fill="none" stroke={T.line} strokeWidth="1.5" />
        <circle cx="45" cy="35" r="4" style={dot} />
        <circle cx="255" cy="35" r="4" style={dot} />
        <circle cx="150" cy="195" r="4" style={dot} />
        <text x="45" y="20" textAnchor="middle" style={label}>PATHOS</text>
        <text x="255" y="20" textAnchor="middle" style={label}>ETHOS</text>
        <text x="150" y="220" textAnchor="middle" style={label}>LOGOS</text>
      </svg>
    </div>
  );
}

function WeekView({ week, state, onBack, onToggleDone, onSaveReflection, onNav }) {
  const w = WEEKS[week - 1];
  const isDone = (state.completed || []).includes(week);
  const [note, setNote] = useState((state.reflections || {})[week] || "");

  useEffect(() => {
    setNote((state.reflections || {})[week] || "");
  }, [week]); // eslint-disable-line

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 96px" }}>
      <button onClick={onBack} style={{
        fontFamily: T.serif, fontSize: 14, background: "none", border: "none",
        color: T.muted, cursor: "pointer", padding: 0, marginBottom: 34,
      }}>← Back to the map</button>

      <Label style={{ marginBottom: 12 }}>Chapter {ROMAN[week - 1]}</Label>
      <h1 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 34, margin: "0 0 10px", color: T.ink, letterSpacing: "-0.01em" }}>
        {w.title}
      </h1>
      <p style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 16.5, color: T.muted, lineHeight: 1.6, marginBottom: 48 }}>
        {w.thesis}
      </p>

      <Section label="Framework">
        {w.framework.map((para, i) => (
          <div key={i}>
            <P>{para}</P>
            {w.diagram === "trustTriangle" && i === w.diagramAfter && <TrustTriangleDiagram />}
          </div>
        ))}
      </Section>

      <Section label="Example">
        {w.example ? (
          <>
            <P>{w.example.what}</P>
            <P italic style={{ color: T.muted }}>What to watch for: {w.example.watchFor}</P>
            {w.example.link && (
              <a href={w.example.link} target="_blank" rel="noreferrer" style={{
                fontFamily: T.serif, fontSize: 14.5, color: T.accent,
              }}>Find the clip →</a>
            )}
          </>
        ) : (
          <P italic style={{ color: T.muted }}>Under construction.</P>
        )}
      </Section>

      <Section label="Case">
        {w.caseStudy ? (
          <>
            <div style={{
              background: T.paper, border: `1px solid ${T.line}`, borderRadius: 3,
              padding: "26px 28px", marginBottom: 22,
            }}>
              <P style={{ marginBottom: 14 }}>{w.caseStudy.setup}</P>
              <P italic style={{ margin: 0, color: T.accent }}>{w.caseStudy.prompt}</P>
            </div>
            <Label style={{ marginBottom: 14 }}>Debrief — read after you've answered</Label>
            {w.caseStudy.debrief.map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: T.serif, color: T.accent, fontSize: 15 }}>·</span>
                <P style={{ margin: 0, fontSize: 15.5 }}>{d}</P>
              </div>
            ))}
          </>
        ) : (
          <P italic style={{ color: T.muted }}>Under construction.</P>
        )}
      </Section>

      <Section label="Reflection — carry this for the week">
        <P italic>{w.reflection}</P>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onSaveReflection(week, note)}
          placeholder="What you noticed this week — saved automatically when you click away."
          rows={5}
          style={{
            fontFamily: T.serif, fontSize: 15.5, padding: 16, width: "100%",
            border: `1px solid ${T.line}`, borderRadius: 3, background: T.paper,
            color: T.ink, lineHeight: 1.7, outline: "none", resize: "vertical",
            marginTop: 8, boxSizing: "border-box",
          }}
        />
      </Section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        {week > 1 ? <Btn onClick={() => onNav(week - 1)}>← {WEEKS[week - 2].title}</Btn> : <div />}
        <Btn primary onClick={() => onToggleDone(week)}>
          {isDone ? "✓ Complete — undo" : "Mark chapter complete"}
        </Btn>
        {week < 8 ? <Btn onClick={() => onNav(week + 1)}>{WEEKS[week].title} →</Btn> : <div />}
      </div>
    </div>
  );
}

/* ———————————— APP ———————————— */

export default function SilverTongue() {
  const [state, setState] = useState(null); // null = loading
  const [view, setView] = useState({ page: "loading" });

  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved && saved.onboarded) {
        setState(saved);
        setView({ page: "map" });
      } else {
        setState({ name: "", onboarded: false, completed: [], reflections: {} });
        setView({ page: "onboarding" });
      }
    })();
  }, []);

  const persist = useCallback((next) => {
    setState(next);
    saveState(next);
  }, []);

  if (!state || view.page === "loading") {
    return (
      <div style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: T.serif, fontStyle: "italic", color: T.muted }}>Opening the book…</div>
      </div>
    );
  }

  const onOnboardDone = (name, week) => {
    const next = { ...state, name, onboarded: true };
    persist(next);
    setView(week ? { page: "week", week } : { page: "map" });
  };

  const toggleDone = (week) => {
    const has = state.completed.includes(week);
    const completed = has ? state.completed.filter((n) => n !== week) : [...state.completed, week];
    persist({ ...state, completed });
  };

  const saveReflection = (week, text) => {
    persist({ ...state, reflections: { ...state.reflections, [week]: text } });
  };

  return (
    <div>
      {view.page === "onboarding" && <Onboarding onDone={onOnboardDone} />}
      {view.page === "map" && (
        <MapView
          state={state}
          onOpenWeek={(n) => setView({ page: "week", week: n })}
          onOpenMoves={() => setView({ page: "moves" })}
        />
      )}
      {view.page === "moves" && <MovesView onBack={() => setView({ page: "map" })} />}
      {view.page === "week" && (
        <WeekView
          week={view.week}
          state={state}
          onBack={() => setView({ page: "map" })}
          onToggleDone={toggleDone}
          onSaveReflection={saveReflection}
          onNav={(n) => setView({ page: "week", week: n })}
        />
      )}
    </div>
  );
}
