// These four dictionaries have native labels. Other languages use the readable
// English fallback until their concept-specific translations are available.
const ids = [
  "fractionAdd",
  "fractionMul",
  "decimalPlace",
  "percentage",
  "average",
  "simpleInterest",
  "rectArea",
  "rectPerimeter",
  "triangleArea",
  "circleArea",
  "circleCircum",
  "linearEq",
];
const categories = [
  "arithmetic",
  "fractions",
  "percentage",
  "geometry",
  "algebra",
];
const labels: Record<
  string,
  {
    categories: string[];
    concepts: string[][];
    logout: string;
    diagram: string;
  }
> = {
  en: {
    categories: [
      "Arithmetic",
      "Fractions",
      "Percentages",
      "Geometry",
      "Algebra",
    ],
    concepts: [
      [
        "Adding fractions",
        "Use a common denominator, then add the numerators.",
      ],
      [
        "Multiplying fractions",
        "Multiply the numerators and denominators, then simplify.",
      ],
      [
        "Decimal place value",
        "Tenths and hundredths represent parts of one whole.",
      ],
      [
        "Finding a percentage",
        "Divide the percentage by 100 and multiply by the whole.",
      ],
      ["Average", "Add all the values and divide by how many there are."],
      ["Simple interest", "Interest depends on the principal, rate and time."],
      ["Area of a rectangle", "Multiply the length by the width."],
      [
        "Perimeter of a rectangle",
        "Add all four sides to find the distance around it.",
      ],
      [
        "Area of a triangle",
        "Multiply the base by the height and divide by two.",
      ],
      ["Area of a circle", "Multiply pi by the square of the radius."],
      ["Circumference of a circle", "Multiply twice the radius by pi."],
      [
        "Solving a linear equation",
        "Use the same operation on both sides to find the unknown.",
      ],
    ],
    logout: "Could not log out. Please try again.",
    diagram:
      "The diagram could not be drawn right now. You can still continue with the explanation.",
  },
  hi: {
    categories: ["अंकगणित", "भिन्न", "प्रतिशत", "ज्यामिति", "बीजगणित"],
    concepts: [
      ["भिन्नों का जोड़", "हर समान करें, फिर अंशों को जोड़ें।"],
      ["भिन्नों का गुणा", "अंशों और हरों का गुणा करें, फिर सरल करें।"],
      ["दशमलव का स्थानीय मान", "दशांश और शतांश एक पूर्ण के भाग हैं।"],
      [
        "प्रतिशत निकालना",
        "प्रतिशत को 100 से भाग दें और कुल मात्रा से गुणा करें।",
      ],
      ["औसत", "सभी मान जोड़ें और उनकी संख्या से भाग दें।"],
      ["साधारण ब्याज", "ब्याज मूलधन, दर और समय पर निर्भर करता है।"],
      ["आयत का क्षेत्रफल", "लंबाई को चौड़ाई से गुणा करें।"],
      ["आयत का परिमाप", "चारों भुजाएँ जोड़कर चारों ओर की दूरी निकालें।"],
      ["त्रिभुज का क्षेत्रफल", "आधार और ऊँचाई का गुणा करके दो से भाग दें।"],
      ["वृत्त का क्षेत्रफल", "त्रिज्या के वर्ग को पाई से गुणा करें।"],
      ["वृत्त की परिधि", "त्रिज्या के दोगुने को पाई से गुणा करें।"],
      [
        "रैखिक समीकरण हल करना",
        "अज्ञात मान निकालने के लिए दोनों पक्षों पर समान क्रिया करें।",
      ],
    ],
    logout: "लॉग आउट नहीं हो सका। कृपया फिर प्रयास करें।",
    diagram: "अभी चित्र नहीं बन सका। आप समझाना जारी रख सकते हैं।",
  },
  te: {
    categories: ["అంకగణితం", "భిన్నాలు", "శాతాలు", "రేఖాగణితం", "బీజగణితం"],
    concepts: [
      ["భిన్నాల కూడిక", "హారాలను సమానం చేసి లవాలను కలపండి."],
      ["భిన్నాల గుణకారం", "లవాలను, హారాలను గుణించి సరళీకరించండి."],
      ["దశాంశ స్థాన విలువ", "పదో వంతులు, వందో వంతులు ఒక మొత్తంలోని భాగాలు."],
      ["శాతాన్ని కనుగొనడం", "శాతాన్ని 100తో భాగించి మొత్తంతో గుణించండి."],
      ["సగటు", "అన్ని విలువలను కలిపి వాటి సంఖ్యతో భాగించండి."],
      ["సాధారణ వడ్డీ", "వడ్డీ అసలు, వడ్డీ రేటు, కాలంపై ఆధారపడుతుంది."],
      ["దీర్ఘచతురస్ర వైశాల్యం", "పొడవును వెడల్పుతో గుణించండి."],
      [
        "దీర్ఘచతురస్ర చుట్టుకొలత",
        "చుట్టూ ఉన్న దూరం కోసం నాలుగు భుజాలను కలపండి.",
      ],
      ["త్రిభుజ వైశాల్యం", "భూమిని ఎత్తుతో గుణించి రెండుతో భాగించండి."],
      ["వృత్త వైశాల్యం", "వ్యాసార్థం వర్గాన్ని పైతో గుణించండి."],
      ["వృత్త చుట్టుకొలత", "వ్యాసార్థం రెట్టింపును పైతో గుణించండి."],
      [
        "రేఖీయ సమీకరణాన్ని సాధించడం",
        "తెలియని విలువ కోసం రెండు వైపులా ఒకే చర్య చేయండి.",
      ],
    ],
    logout: "లాగ్ అవుట్ కాలేదు. మళ్లీ ప్రయత్నించండి.",
    diagram: "ప్రస్తుతం బొమ్మ గీయలేకపోయాం. వివరణను కొనసాగించవచ్చు.",
  },
  ta: {
    categories: [
      "எண்கணிதம்",
      "பின்னங்கள்",
      "சதவீதங்கள்",
      "வடிவியல்",
      "இயற்கணிதம்",
    ],
    concepts: [
      [
        "பின்னங்களைக் கூட்டுதல்",
        "பகுதிகளைச் சமமாக்கிப் பின்னர் தொகுதிகளைக் கூட்டவும்.",
      ],
      [
        "பின்னங்களைப் பெருக்குதல்",
        "தொகுதிகளையும் பகுதிகளையும் பெருக்கிச் சுருக்கவும்.",
      ],
      [
        "தசம இடமதிப்பு",
        "பத்தில் ஒரு பங்கும் நூறில் ஒரு பங்கும் முழுமையின் பகுதிகள்.",
      ],
      [
        "சதவீதத்தைக் கண்டறிதல்",
        "சதவீதத்தை 100ஆல் வகுத்து மொத்தத்தால் பெருக்கவும்.",
      ],
      [
        "சராசரி",
        "எல்லா மதிப்புகளையும் கூட்டி அவற்றின் எண்ணிக்கையால் வகுக்கவும்.",
      ],
      ["தனிவட்டி", "வட்டி அசல், வட்டி விகிதம் மற்றும் காலத்தைச் சார்ந்தது."],
      ["செவ்வகத்தின் பரப்பளவு", "நீளத்தை அகலத்தால் பெருக்கவும்."],
      [
        "செவ்வகத்தின் சுற்றளவு",
        "நான்கு பக்கங்களையும் கூட்டிச் சுற்றியுள்ள தூரத்தைக் காணவும்.",
      ],
      [
        "முக்கோணத்தின் பரப்பளவு",
        "அடிப்பக்கத்தை உயரத்தால் பெருக்கி இரண்டால் வகுக்கவும்.",
      ],
      ["வட்டத்தின் பரப்பளவு", "ஆரத்தின் வர்க்கத்தை பையால் பெருக்கவும்."],
      ["வட்டத்தின் சுற்றளவு", "ஆரத்தின் இருமடங்கை பையால் பெருக்கவும்."],
      [
        "நேரியல் சமன்பாட்டைத் தீர்த்தல்",
        "தெரியாத மதிப்பைக் காண இருபுறமும் ஒரே செயலைச் செய்யவும்.",
      ],
    ],
    logout: "வெளியேற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    diagram: "இப்போது படம் வரைய முடியவில்லை. விளக்கத்தைத் தொடரலாம்.",
  },
};
export const conceptTranslations: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  Object.entries(labels).map(([language, values]) => [
    language,
    {
      ...Object.fromEntries(
        categories.map((id, i) => [`concept.cat.${id}`, values.categories[i]]),
      ),
      ...Object.fromEntries(
        ids.flatMap((id, i) => [
          [`concept.item.${id}.name`, values.concepts[i][0]],
          [`concept.item.${id}.desc`, values.concepts[i][1]],
        ]),
      ),
      "logout.error": values.logout,
      "chat.diagramUnavailable": values.diagram,
      "messages.parentSubtitle":
        language === "hi"
          ? "अपने बच्चे के शिक्षकों से बात करें"
          : language === "te"
            ? "మీ పిల్లల ఉపాధ్యాయులతో మాట్లాడండి"
            : language === "ta"
              ? "உங்கள் குழந்தையின் ஆசிரியர்களுடன் பேசுங்கள்"
              : "Chat with your child's tutors",
    },
  ]),
);
