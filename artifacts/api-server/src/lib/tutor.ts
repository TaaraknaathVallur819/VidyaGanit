export type StudentContext = {
  name: string;
  studentClass: string | null;
  board: string | null;
};

export type ChatEntry = {
  role: "user" | "assistant";
  content: string;
};

export type Topic =
  | "greeting"
  | "giveup"
  | "fraction"
  | "multiply"
  | "divide"
  | "add_subtract"
  | "percent"
  | "geometry"
  | "algebra"
  | "decimal"
  | "ratio"
  | "general";

function firstName(ctx: StudentContext): string {
  return ctx.name.split(" ")[0];
}

function classLevel(ctx: StudentContext): number {
  return parseInt(ctx.studentClass ?? "5", 10);
}

function isHigherClass(ctx: StudentContext): boolean {
  return classLevel(ctx) >= 6;
}

export function detectTopic(msg: string): Topic {
  const m = msg.toLowerCase();

  if (/\b(hi|hello|hey|good morning|good afternoon|namaste|hola)\b/.test(m))
    return "greeting";

  if (
    /i\s*(don[''t]*\s*know|give\s*up|can'?t|no\s*idea|am\s*stuck|am stuck|lost)|just\s*tell\s*me|tell\s*me\s*(the\s*)?(answer|solution)|what.*answer|idk|give me the answer|please just|i quit|i give up|what is the answer/.test(
      m,
    )
  )
    return "giveup";

  if (
    /fraction|numerator|denominator|½|⅓|⅔|1\/[2-9]|[2-9]\/[2-9]|equal parts|out of|simplif|proper fraction|improper fraction|mixed number/.test(
      m,
    )
  )
    return "fraction";

  if (/percent|%|discount|profit|loss|interest|commission/.test(m))
    return "percent";

  if (
    /area|perimeter|circle|radius|diameter|triangle|square|rectangle|polygon|angle|degree|circumference|volume|surface area/.test(
      m,
    )
  )
    return "geometry";

  if (
    /equation|variable|algebra|solve for|unknown|expression|x\s*[+\-=*\/]|[+\-=*\/]\s*x|2x|3x|find\s*x|simplify.*expression/.test(
      m,
    )
  )
    return "algebra";

  if (/ratio|proportion|rate|speed.*distance|distance.*time|scale/.test(m))
    return "ratio";

  if (/decimal|0\.\d|\.\d+|tenths?|hundredths?/.test(m)) return "decimal";

  if (
    /multipl|times|×|\d+\s*[×x\*]\s*\d+|product|twice|thrice|\d+\s*times/.test(
      m,
    )
  )
    return "multiply";

  if (
    /divid|÷|split.*equal|share.*equal|quotient|how many.*each|into.*group/.test(
      m,
    )
  )
    return "divide";

  if (
    /add|plus|\+|sum|total|altogether|combined|subtract|minus|difference|how many.*left|remaining|take away/.test(
      m,
    )
  )
    return "add_subtract";

  return "general";
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function greet(ctx: StudentContext): string {
  const fn = firstName(ctx);
  const cls = ctx.studentClass ? `Class ${ctx.studentClass}` : "";
  const board = ctx.board ? ` ${ctx.board}` : "";
  return (
    `Hey ${fn}! 👋 Welcome to your VidyaGanit Maths Workspace! 🚀\n\n` +
    `I'm your Socratic Tutor — I will NEVER hand you the answer directly, but I WILL help you discover it yourself. ` +
    `That makes it stick in your brain forever! 🧠✨\n\n` +
    `I know your ${cls}${board} syllabus really well, so ask me ANY maths challenge — ` +
    `fractions, multiplication, geometry, percentages, equations... anything!\n\n` +
    `What maths problem shall we tackle first? 🌟`
  );
}

function giveup(ctx: StudentContext, history: ChatEntry[]): string {
  const fn = firstName(ctx);
  const attempts = history.filter((h) => h.role === "user").length;

  if (attempts <= 1) {
    return (
      `Hey ${fn}, I hear you — but I believe in you! 💪 That stuck feeling? ` +
      `It just means your brain is RIGHT at the edge of learning something new! 🧠\n\n` +
      `Let me give you a gentler clue — forget the numbers for a second. ` +
      `Imagine you have a bar of chocolate 🍫 with 10 pieces and you want to share it equally. ` +
      `What would you do FIRST — before any calculating?\n\nJust tell me that one tiny step! 🤔`
    );
  }
  if (attempts <= 4) {
    return (
      `${fn}, I won't give up on you — and you shouldn't either! 🌟\n\n` +
      `Let me zoom WAY out. Forget all the numbers for a moment. ` +
      `Is this problem asking you to make something BIGGER, make it SMALLER, SPLIT something, or COMBINE things?\n\n` +
      `Just tell me one of those four words — that's your real first step! 🎯`
    );
  }
  return (
    `Okay ${fn}, I can see this one is genuinely tough — and that means you're working on something important! 💙\n\n` +
    `Here is the tiniest breadcrumb I can give you (but still NOT the answer 😄): ` +
    `Look only at the FIRST number in the problem. Is it a whole number (like 5 or 12), ` +
    `a fraction (like 3/4), or a decimal (like 0.7)?\n\n` +
    `Tell me just that! Once we identify what kind of number we're dealing with, the path becomes much clearer! 🔍`
  );
}

const fractionHintsLower = [
  (fn: string) =>
    `Great question! 🍕 Let me explain with a pizza! Imagine one whole pizza cut into EQUAL slices. ` +
    `A fraction tells us: "how many slices we have" OUT OF "how many slices the whole pizza was cut into."\n\n` +
    `So 3/8 means we have 3 slices out of a pizza cut into 8. ` +
    `The TOP number (numerator) = our slices. The BOTTOM number (denominator) = total slices.\n\n` +
    `Now, looking at YOUR problem — what do you think goes on TOP? 🤔`,

  (fn: string) =>
    `Nice one, ${fn}! 🍫 Let's use a chocolate bar! Say the bar has 6 pieces. ` +
    `Your friend eats 2 pieces. The fraction your friend ate = 2/6 — ` +
    `two pieces OUT OF six total.\n\n` +
    `The "out of" number ALWAYS goes on the BOTTOM. ` +
    `In YOUR problem, what is the "TOTAL" — the bottom number? Can you spot it? 🧐`,

  (fn: string) =>
    `Cricket time 🏏! A batsman scored 40 runs out of a team total of 200. ` +
    `His fraction of the total = 40/200. The "out of" number (200) sits at the BOTTOM!\n\n` +
    `For your problem: which number is the TOTAL (the "out of")? Write it down as the bottom number first! 🎯`,

  (fn: string) =>
    `${fn}, fractions are like SHARING 🤝. If 4 friends share one chocolate bar equally ` +
    `and you take 1 piece, you got 1/4 — 1 part out of 4 equal parts. ` +
    `Bottom = total equal parts.\n\nIn YOUR problem: how many EQUAL parts is the whole thing divided into? Just tell me that number! 🔍`,
];

const fractionHintsHigher = [
  (fn: string) =>
    `Let's approach this systematically, ${fn}! 🧮 In cricket 🏏, ` +
    `if a team scored 120 out of a target of 300, their run fraction = 120/300. ` +
    `We simplify by dividing both numbers by their HCF (Highest Common Factor).\n\n` +
    `For your problem — what is the HCF of the numerator and denominator? That's your first step! 🤔`,

  (fn: string) =>
    `Interesting, ${fn}! 🌟 Remember: when ADDING or SUBTRACTING fractions, ` +
    `the denominators must be the SAME first. Think of it like this — ` +
    `you can't add half a pizza and a third of a pizza directly! You need equal-sized slices first.\n\n` +
    `What is the LCM of the denominators in your problem? Find that first! 🧐`,

  (fn: string) =>
    `${fn}, let's break it down step by step 🧮. ` +
    `When MULTIPLYING fractions: multiply numerators together, multiply denominators together. ` +
    `When DIVIDING fractions: flip the SECOND fraction (find its reciprocal), then multiply.\n\n` +
    `Looking at your problem — are you multiplying or dividing the fractions here? 🎯`,
];

const multiplyHintsLower = [
  (fn: string) =>
    `Think of multiplication as GROUPS, ${fn}! 🚀 ` +
    `4 × 3 means "4 groups of 3 things." Picture 4 bags of chocolates 🍫, each bag with 3 chocolates. ` +
    `How many total? Count the groups!\n\n` +
    `In YOUR problem — what is being REPEATED, and how many times? Can you picture it? 🤔`,

  (fn: string) =>
    `Cricket time 🏏! A batsman scores 6 runs per over. After 5 overs = 6 × 5 runs. ` +
    `Think of it as 5 groups of 6. Count them: 6, 12, 18, 24, 30!\n\n` +
    `For YOUR problem, what is the "group size" and how many "groups" are there? Just tell me those two numbers first! 🌟`,

  (fn: string) =>
    `${fn}, here is a great trick — break the bigger number into TENS and ONES! 🧮 ` +
    `Like 6 × 13 = (6 × 10) + (6 × 3) = 60 + 18 = 78. We split 13 into 10 + 3!\n\n` +
    `For YOUR problem, can you split the bigger number into its tens part and ones part? ` +
    `What is the TENS part? Start there! 🤔`,
];

const multiplyHintsHigher = [
  (fn: string) =>
    `${fn}, use the distributive property! 🧮 Like 23 × 17 = 23 × (10 + 7) = (23 × 10) + (23 × 7) = 230 + 161 = 391. ` +
    `Split the second number into convenient parts.\n\nFor YOUR numbers — what two parts will you break the second number into? 🤔`,

  (fn: string) =>
    `Think leaderboard 🎮! If 35 players each score 48 points: 35 × 48 = 35 × 40 + 35 × 8 = 1400 + 280 = 1680. ` +
    `Break the harder number at its tens digit!\n\nFor your problem, what is the bigger number × its TENS digit first? 🎯`,
];

const divideHintsLower = [
  (fn: string) =>
    `Division is just EQUAL SHARING, ${fn}! 🤝 ` +
    `12 chocolates 🍫 shared equally among 4 friends = 12 ÷ 4. ` +
    `Think: "how many groups of 4 fit into 12?"\n\n` +
    `In YOUR problem — what is the TOTAL being shared, and how many people or groups are sharing? ` +
    `Can you identify those two numbers? 🤔`,

  (fn: string) =>
    `Let's use cricket! 🏏 A team scored 280 runs in 40 overs. ` +
    `Runs per over = 280 ÷ 40 = 7. We divided the TOTAL by NUMBER OF OVERS.\n\n` +
    `In your problem — which number is the TOTAL? And what are we dividing by? Just spot those two first! 🌟`,

  (fn: string) =>
    `${fn}, think of it as counting up! 🎯 ` +
    `15 ÷ 3 = ? means "how many 3s are there in 15?" ` +
    `Count: 3, 6, 9, 12, 15 — that's FIVE threes! So 15 ÷ 3 = 5.\n\n` +
    `For your problem — what is the number we're COUNTING UP TO? Try that approach! 🤔`,
];

const divideHintsHigher = [
  (fn: string) =>
    `${fn}, for long division remember: Divide → Multiply → Subtract → Bring down. ` +
    `Think of it as D.M.S.B! 🧮\n\n` +
    `Look at the FIRST one or two digits of your dividend. Can that be divided by the divisor? ` +
    `What is your estimate for the FIRST digit of the quotient? 🤔`,

  (fn: string) =>
    `Cricket scoring 🏏! Team needs 378 runs in 54 overs. Run rate = 378 ÷ 54. ` +
    `Round 54 to 50 first — 378 ÷ 50 ≈ 7.5. So first estimate ≈ 7.\n\n` +
    `For YOUR problem — round your divisor to the nearest 10. ` +
    `What approximate answer do you get? Start from there! 🌟`,
];

const percentHintsLower = [
  (fn: string) =>
    `Percentages are just fractions with 100 as the bottom, ${fn}! 🌟 ` +
    `"50%" = 50 out of 100 = half. "25%" = 25 out of 100 = one quarter!\n\n` +
    `Imagine a mobile game 🎮 where you scored 75 out of 100 stars — that's just 75%!\n\n` +
    `In YOUR problem, what is the TOTAL (the "out of 100" base)? Can you identify it? 🤔`,

  (fn: string) =>
    `${fn}, pizza trick! 🍕 A pizza has 8 slices. You eat 2. ` +
    `What % did you eat? → (2 ÷ 8) × 100 = 25%. ` +
    `Divide the PART by the TOTAL, then multiply by 100!\n\n` +
    `In your problem, which number is the PART and which is the TOTAL? Just name those two! 🧐`,
];

const percentHintsHigher = [
  (fn: string) =>
    `${fn}, for profit/loss remember: Profit% = (Profit ÷ Cost Price) × 100. ` +
    `IMPORTANT: profit percentage is ALWAYS calculated on the COST PRICE (CP), not the selling price! 🏪\n\n` +
    `In your problem, have you found both CP and SP? Which is higher? 🤔`,

  (fn: string) =>
    `Sale at a clothing store 🛍️! A shirt costs ₹500. 20% discount. ` +
    `Discount amount = 20% of 500 = (20/100) × 500 = ₹100. Sale price = 500 − 100 = ₹400.\n\n` +
    `For your problem — first find the discount or profit/loss AMOUNT using the percentage formula. ` +
    `What is (percentage/100) × base? 🎯`,

  (fn: string) =>
    `${fn}, Simple Interest formula: SI = (P × R × T) / 100. ` +
    `P = Principal, R = Rate per year, T = Time in years. 🧮\n\n` +
    `Which of these three values does your problem give you? List them out — that tells you what to put into the formula! 🤔`,
];

function geometryHint(ctx: StudentContext, msg: string, attempts: number): string {
  const fn = firstName(ctx);
  const m = msg.toLowerCase();
  const isHigh = isHigherClass(ctx);

  if (/perimeter/.test(m)) {
    return isHigh
      ? `${fn}, for composite shapes — split them first! ✂️ Break any complex shape into rectangles, triangles, or semicircles you recognise, find each part's perimeter contribution, then add.\n\nFor YOUR shape: can you sketch it and identify which simpler shapes it's made of? What's your first cut? 🤔`
      : `Perimeter is like putting a fence around your garden 🌿, ${fn}! You just ADD ALL the sides. For a rectangle: P = 2 × (length + width). For a square: P = 4 × side.\n\nIn YOUR shape, how many sides does it have? What are their lengths? Add just the FIRST two sides and tell me the total! 🤔`;
  }
  if (/area/.test(m)) {
    return isHigh
      ? `${fn}, for area of composite figures — SPLIT and ADD (or subtract)! 🧩 Break the shape into simpler ones:\n• Rectangle: l × b\n• Triangle: ½ × b × h\n• Circle: π × r²\n\nWhich simpler shapes can you spot in your figure? Tell me that first! 🤔`
      : `Area = the SPACE INSIDE a shape, ${fn}! 🏠 Think: how many 1cm tiles would cover this floor?\n• Rectangle: Area = length × width\n• Square: Area = side × side\n• Triangle: Area = ½ × base × height\n\nWhich shape do you have? Once you tell me, we'll pick the right formula! 🤔`;
  }
  if (/circle|radius|diameter|circumference/.test(m)) {
    return (
      `Circles are everywhere 🎯, ${fn}! Key facts:\n` +
      `• Radius (r) = center to edge\n` +
      `• Diameter (d) = across the whole circle = 2 × r\n` +
      `• Circumference = 2 × π × r ≈ 2 × 3.14 × r\n` +
      `• Area = π × r²\n\n` +
      `In YOUR problem — have you been given the RADIUS or the DIAMETER? Just tell me which one and its value! 🤔`
    );
  }
  if (/angle|triangle|theorem/.test(m)) {
    return (
      `📐 Key angle facts, ${fn}:\n` +
      `• Angles in a triangle = 180°\n` +
      `• Angles on a straight line = 180°\n` +
      `• Angles around a point = 360°\n` +
      `• Vertically opposite angles are equal\n\n` +
      `In YOUR problem — which angles have already been given to you? Add those up first and tell me what you get! 🤔`
    );
  }
  return (
    `In geometry, the FIRST step is always to DRAW and LABEL, ${fn}! 📐 ` +
    `Sketch the shape and mark every measurement you've been given.\n\n` +
    `What shape is it and what measurements do you know? List them out — ` +
    `sometimes just seeing them written down makes the path obvious! 🤔`
  );
}

const algebraHints = [
  (fn: string) =>
    `Algebra is like a mystery game, ${fn}! 🔍 ` +
    `The unknown 'x' is the mystery number. ` +
    `Like: "I have some coins, and after earning 5 more I have 12." → x + 5 = 12 → x = 12 − 5 = 7!\n\n` +
    `For YOUR equation — what operation is being done TO x? Addition, subtraction, multiplication, or division? 🤔`,

  (fn: string) =>
    `Think of an equation as a perfectly BALANCED weighing scale ⚖️, ${fn}! ` +
    `Whatever you do to one side, do the EXACT SAME to the other side to keep it balanced.\n\n` +
    `To find x, get it ALONE on one side. What is currently WITH x that you need to move? 🌟`,

  (fn: string) =>
    `Mobile game analogy 🎮, ${fn}! You have some gems (x), and after earning 15 more you have 40. ` +
    `That's x + 15 = 40. To find x: subtract 15 from BOTH sides → x = 40 − 15 = 25!\n\n` +
    `For YOUR equation — what number is WITH x? What's the OPPOSITE operation to move it? 🤔`,
];

const ratioHintsLower = [
  (fn: string) =>
    `Ratios are just COMPARISONS, ${fn}! 🏏 ` +
    `If a cricket team has 6 batsmen and 4 bowlers, ratio of batsmen to bowlers = 6:4 = 3:2 ` +
    `(simplified by dividing both by 2).\n\n` +
    `In YOUR problem — what TWO things are being compared, and what are their amounts? ` +
    `Write the two numbers side by side first! 🤔`,
];

const ratioHintsHigher = [
  (fn: string) =>
    `${fn}, for ratio division problems: if amounts are in ratio a:b and total is T, ` +
    `then First part = (a/(a+b)) × T and Second part = (b/(a+b)) × T. 🧮\n\n` +
    `In your problem, what is a+b (the SUM of the ratio parts)? Calculate that first! 🤔`,

  (fn: string) =>
    `Speed-distance-time, ${fn}! 🚗 ` +
    `The golden triangle: Distance = Speed × Time, Speed = Distance ÷ Time, Time = Distance ÷ Speed.\n\n` +
    `In your problem, which TWO of these three values are given? Identify them and then pick the right formula! 🎯`,
];

const decimalHints = [
  (fn: string, isHigh: boolean) =>
    isHigh
      ? `${fn}, decimals are just fractions with denominators of 10, 100, 1000... 🧮 ` +
        `0.7 = 7/10, 0.25 = 25/100 = 1/4.\n\n` +
        `For multiplication with decimals: ignore the decimal point first, multiply as whole numbers, ` +
        `then COUNT total decimal places in BOTH numbers and put that many in the answer.\n\n` +
        `How many decimal places are there in each number? Count those first! 🤔`
      : `Let's think about MONEY, ${fn}! 💰 ` +
        `₹3.50 means 3 whole rupees and 50 paise. The dot separates "whole" from "parts"!\n\n` +
        `In YOUR problem — look at the decimal point. What is the WHOLE number part (left of the dot)? ` +
        `And what is the fraction part (right of the dot)? Just identify those two parts! 🤔`,
];

const addSubtractHintsLower = [
  (fn: string) =>
    `Cricket scoreboard 🏏, ${fn}! Team A has 145 runs and scores 37 more. ` +
    `Add: 145 + 37. First add the ONES column (5+7 = 12, write 2, carry 1), ` +
    `then TENS (4+3+1 = 8), then HUNDREDS (1). Total = 182!\n\n` +
    `For YOUR problem — have you lined up the digits properly (ones under ones, tens under tens)? ` +
    `What do you get in the ONES column? Start there! 🤔`,
];

const addSubtractHintsHigher = [
  (fn: string) =>
    `${fn}, for large numbers or decimals — ALWAYS align decimal points first! 🧮 ` +
    `Then work column by column from RIGHT to LEFT. ` +
    `Carry forward or borrow as needed.\n\n` +
    `For YOUR problem — set up the column addition/subtraction now. ` +
    `What does the RIGHTMOST column look like? 🤔`,
];

const generalHints = [
  (fn: string) =>
    `Interesting problem, ${fn}! 🌟 Before we dive in, let's break it down.\n\n` +
    `In maths, always start by asking two questions:\n` +
    `1️⃣ What information have I been GIVEN?\n` +
    `2️⃣ What do I need to FIND?\n\n` +
    `Can you list the numbers and facts the problem gives you? Start with that! 🤔`,

  (fn: string) =>
    `${fn}, when a problem feels big — try this trick! 🚀 ` +
    `Read it once, then close your eyes and describe it to an imaginary friend in ONE sentence. ` +
    `What is this problem actually ABOUT in simple words?\n\nTell me that one sentence! 🎯`,

  (fn: string) =>
    `Let's think step by step, ${fn}! 🧠 Every maths problem has three parts:\n` +
    `1️⃣ What you KNOW (the given numbers)\n` +
    `2️⃣ What you WANT to find\n` +
    `3️⃣ The CONNECTION between them (the operation)\n\n` +
    `Start with step 1 — what numbers are you given? List all of them! 🔍`,
];

export function generateSocraticResponse(
  message: string,
  context: StudentContext,
  history: ChatEntry[],
): string {
  const topic = detectTopic(message);
  const userTurns = history.filter((h) => h.role === "user").length;
  const isHigh = isHigherClass(context);
  const fn = firstName(context);

  switch (topic) {
    case "greeting":
      return greet(context);

    case "giveup":
      return giveup(context, history);

    case "fraction":
      return isHigh
        ? pick(fractionHintsHigher, userTurns)(fn)
        : pick(fractionHintsLower, userTurns)(fn);

    case "multiply":
      return isHigh
        ? pick(multiplyHintsHigher, userTurns)(fn)
        : pick(multiplyHintsLower, userTurns)(fn);

    case "divide":
      return isHigh
        ? pick(divideHintsHigher, userTurns)(fn)
        : pick(divideHintsLower, userTurns)(fn);

    case "percent":
      return isHigh
        ? pick(percentHintsHigher, userTurns)(fn)
        : pick(percentHintsLower, userTurns)(fn);

    case "geometry":
      return geometryHint(context, message, userTurns);

    case "algebra":
      return pick(algebraHints, userTurns)(fn);

    case "ratio":
      return isHigh
        ? pick(ratioHintsHigher, userTurns)(fn)
        : pick(ratioHintsLower, userTurns)(fn);

    case "decimal":
      return pick(decimalHints, userTurns)(fn, isHigh);

    case "add_subtract":
      return isHigh
        ? pick(addSubtractHintsHigher, userTurns)(fn)
        : pick(addSubtractHintsLower, userTurns)(fn);

    default:
      return pick(generalHints, userTurns)(fn);
  }
}
