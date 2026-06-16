import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Language = "en" | "ta" | "hi" | "te";

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
];

const STORAGE_KEY = "vidyaganit_lang";

type Dict = Record<string, string>;

const en: Dict = {
  "dashboard.title": "Parent Dashboard",
  "language.label": "Language",

  "tab.profile": "My Profile",
  "tab.progress": "Progress",
  "tab.history": "History",
  "tab.strategy": "Strategy AI",

  // Profile
  "profile.edit": "Edit Profile",
  "profile.changePassword": "Change Password",
  "profile.relationship": "Relationship",
  "profile.gender": "Gender",
  "profile.contact": "Contact",
  "profile.notProvided": "Not provided",
  "profile.father": "Father",
  "profile.mother": "Mother",
  "profile.male": "Male",
  "profile.female": "Female",
  "profile.connectedStudents": "Connected Students",
  "profile.linked": "linked",
  "profile.linkPlaceholder": "Enter student's VidyaGanit ID (e.g. VG-STU-12345)",
  "profile.link": "Link",
  "profile.noStudentsTitle": "No linked students yet",
  "profile.noStudentsHint": "Enter your child's VidyaGanit ID above to connect their account.",
  "profile.class": "Class",
  "profile.removeStudent": "Remove student",

  // Student picker
  "picker.label": "Viewing",
  "picker.placeholder": "Select a child",
  "picker.empty.title": "No children connected yet",
  "picker.empty.hint": "Go to My Profile and link your child's VidyaGanit ID to see their progress here.",

  // Progress
  "progress.title": "Progress Analytics",
  "progress.subtitle": "How your child is engaging with each topic on VidyaGanit.",
  "progress.mastery": "Mastery",
  "progress.questions": "Questions practised",
  "progress.sessions": "Sessions",
  "progress.totalSessions": "Total sessions",
  "progress.totalMessages": "Total questions asked",
  "progress.note": "Mastery is an activity-based estimate from practice on VidyaGanit, not a formal test score.",
  "progress.empty.title": "No practice yet",
  "progress.empty.hint": "Once your child starts asking maths questions, their topic progress will appear here.",
  "progress.loading": "Loading progress…",

  // History
  "history.title": "Saved Socratic History",
  "history.subtitle": "Full transcripts of your child's tutoring conversations.",
  "history.session": "Session",
  "history.messages": "messages",
  "history.student": "Student",
  "history.tutor": "Tutor",
  "history.empty.title": "No conversations yet",
  "history.empty.hint": "Your child's saved tutoring chats will show up here once they start learning.",
  "history.loading": "Loading history…",

  // Strategy AI
  "strategy.title": "Ask Strategy AI",
  "strategy.subtitle": "Your personal counsellor for supporting your child's maths learning.",
  "strategy.placeholder": "Ask how to help your child…",
  "strategy.send": "Send",
  "strategy.about": "Advising about",
  "strategy.general": "General advice",
  "strategy.clear": "Clear chat",
  "strategy.listening": "Listening…",
  "strategy.transcribing": "Transcribing…",
  "strategy.recording": "Recording… tap to stop",
  "strategy.micUnsupported": "Voice input isn't available in this browser. Please type your question.",
  "strategy.attach": "Attach a file",
  "strategy.camera": "Take a photo",
  "strategy.welcome":
    "Hello! I'm your Strategy AI counsellor. Ask me anything about supporting your child's maths learning — daily routines, building confidence, or handling tricky topics. Pick a child above and I'll tailor my advice to their progress.",
  "strategy.error": "Sorry, I had trouble connecting. Please try again.",
  "strategy.fileTooBig": "That file is too big! Please pick one under 8 MB.",
};

const ta: Dict = {
  "dashboard.title": "பெற்றோர் டாஷ்போர்டு",
  "language.label": "மொழி",

  "tab.profile": "என் சுயவிவரம்",
  "tab.progress": "முன்னேற்றம்",
  "tab.history": "வரலாறு",
  "tab.strategy": "உத்தி AI",

  "profile.edit": "சுயவிவரத்தைத் திருத்து",
  "profile.changePassword": "கடவுச்சொல்லை மாற்று",
  "profile.relationship": "உறவு",
  "profile.gender": "பாலினம்",
  "profile.contact": "தொடர்பு",
  "profile.notProvided": "வழங்கப்படவில்லை",
  "profile.father": "தந்தை",
  "profile.mother": "தாய்",
  "profile.male": "ஆண்",
  "profile.female": "பெண்",
  "profile.connectedStudents": "இணைக்கப்பட்ட மாணவர்கள்",
  "profile.linked": "இணைக்கப்பட்டது",
  "profile.linkPlaceholder": "மாணவரின் VidyaGanit ID ஐ உள்ளிடவும் (எ.கா. VG-STU-12345)",
  "profile.link": "இணை",
  "profile.noStudentsTitle": "இன்னும் மாணவர்கள் இணைக்கப்படவில்லை",
  "profile.noStudentsHint": "உங்கள் குழந்தையின் VidyaGanit ID ஐ மேலே உள்ளிட்டு கணக்கை இணைக்கவும்.",
  "profile.class": "வகுப்பு",
  "profile.removeStudent": "மாணவரை அகற்று",

  "picker.label": "பார்க்கிறீர்கள்",
  "picker.placeholder": "ஒரு குழந்தையைத் தேர்ந்தெடுக்கவும்",
  "picker.empty.title": "இன்னும் குழந்தைகள் இணைக்கப்படவில்லை",
  "picker.empty.hint": "என் சுயவிவரத்திற்குச் சென்று உங்கள் குழந்தையின் VidyaGanit ID ஐ இணைக்கவும்.",

  "progress.title": "முன்னேற்ற பகுப்பாய்வு",
  "progress.subtitle": "ஒவ்வொரு தலைப்பிலும் உங்கள் குழந்தை எவ்வாறு ஈடுபடுகிறது.",
  "progress.mastery": "தேர்ச்சி",
  "progress.questions": "பயிற்சி செய்த கேள்விகள்",
  "progress.sessions": "அமர்வுகள்",
  "progress.totalSessions": "மொத்த அமர்வுகள்",
  "progress.totalMessages": "கேட்ட மொத்த கேள்விகள்",
  "progress.note": "தேர்ச்சி என்பது VidyaGanit பயிற்சியின் அடிப்படையிலான மதிப்பீடு, தேர்வு மதிப்பெண் அல்ல.",
  "progress.empty.title": "இன்னும் பயிற்சி இல்லை",
  "progress.empty.hint": "உங்கள் குழந்தை கணக்குக் கேள்விகளைக் கேட்கத் தொடங்கியதும் முன்னேற்றம் இங்கே தோன்றும்.",
  "progress.loading": "முன்னேற்றம் ஏற்றப்படுகிறது…",

  "history.title": "சேமித்த சாக்ரடிக் வரலாறு",
  "history.subtitle": "உங்கள் குழந்தையின் பயிற்சி உரையாடல்களின் முழு பதிவுகள்.",
  "history.session": "அமர்வு",
  "history.messages": "செய்திகள்",
  "history.student": "மாணவர்",
  "history.tutor": "ஆசிரியர்",
  "history.empty.title": "இன்னும் உரையாடல்கள் இல்லை",
  "history.empty.hint": "உங்கள் குழந்தை கற்கத் தொடங்கியதும் சேமித்த அரட்டைகள் இங்கே தோன்றும்.",
  "history.loading": "வரலாறு ஏற்றப்படுகிறது…",

  "strategy.title": "உத்தி AI ஐக் கேளுங்கள்",
  "strategy.subtitle": "உங்கள் குழந்தையின் கணிதக் கற்றலுக்கு உதவும் தனிப்பட்ட ஆலோசகர்.",
  "strategy.placeholder": "உங்கள் குழந்தைக்கு எப்படி உதவுவது என்று கேளுங்கள்…",
  "strategy.send": "அனுப்பு",
  "strategy.about": "ஆலோசனை குறித்து",
  "strategy.general": "பொது ஆலோசனை",
  "strategy.clear": "அரட்டையை அழி",
  "strategy.listening": "கேட்கிறது…",
  "strategy.transcribing": "எழுத்தாக்கப்படுகிறது…",
  "strategy.recording": "பதிவு செய்கிறது… நிறுத்த தட்டவும்",
  "strategy.micUnsupported": "இந்த உலாவியில் குரல் உள்ளீடு கிடைக்கவில்லை. தயவுசெய்து தட்டச்சு செய்யவும்.",
  "strategy.attach": "கோப்பை இணைக்கவும்",
  "strategy.camera": "புகைப்படம் எடுக்கவும்",
  "strategy.welcome":
    "வணக்கம்! நான் உங்கள் உத்தி AI ஆலோசகர். உங்கள் குழந்தையின் கணிதக் கற்றலுக்கு உதவுவது குறித்து எதையும் கேளுங்கள் — தினசரி வழக்கங்கள், நம்பிக்கையை வளர்ப்பது, அல்லது கடினமான தலைப்புகள். மேலே ஒரு குழந்தையைத் தேர்ந்தெடுத்தால் அவர்களின் முன்னேற்றத்திற்கு ஏற்ப ஆலோசனை வழங்குவேன்.",
  "strategy.error": "மன்னிக்கவும், இணைப்பதில் சிக்கல். மீண்டும் முயற்சிக்கவும்.",
  "strategy.fileTooBig": "அந்தக் கோப்பு மிகப் பெரியது! 8 MB க்கு குறைவாக ஒன்றைத் தேர்ந்தெடுக்கவும்.",
};

const hi: Dict = {
  "dashboard.title": "पैरेंट डैशबोर्ड",
  "language.label": "भाषा",

  "tab.profile": "मेरी प्रोफ़ाइल",
  "tab.progress": "प्रगति",
  "tab.history": "इतिहास",
  "tab.strategy": "रणनीति AI",

  "profile.edit": "प्रोफ़ाइल संपादित करें",
  "profile.changePassword": "पासवर्ड बदलें",
  "profile.relationship": "रिश्ता",
  "profile.gender": "लिंग",
  "profile.contact": "संपर्क",
  "profile.notProvided": "उपलब्ध नहीं",
  "profile.father": "पिता",
  "profile.mother": "माता",
  "profile.male": "पुरुष",
  "profile.female": "महिला",
  "profile.connectedStudents": "जुड़े हुए छात्र",
  "profile.linked": "जुड़े",
  "profile.linkPlaceholder": "छात्र का VidyaGanit ID दर्ज करें (जैसे VG-STU-12345)",
  "profile.link": "जोड़ें",
  "profile.noStudentsTitle": "अभी तक कोई छात्र नहीं जुड़ा",
  "profile.noStudentsHint": "अपने बच्चे का VidyaGanit ID ऊपर दर्ज करके उनका खाता जोड़ें।",
  "profile.class": "कक्षा",
  "profile.removeStudent": "छात्र हटाएँ",

  "picker.label": "देख रहे हैं",
  "picker.placeholder": "एक बच्चा चुनें",
  "picker.empty.title": "अभी तक कोई बच्चा नहीं जुड़ा",
  "picker.empty.hint": "मेरी प्रोफ़ाइल पर जाएँ और अपने बच्चे का VidyaGanit ID जोड़ें ताकि उनकी प्रगति यहाँ दिखे।",

  "progress.title": "प्रगति विश्लेषण",
  "progress.subtitle": "आपका बच्चा हर विषय में कैसे जुड़ रहा है।",
  "progress.mastery": "दक्षता",
  "progress.questions": "अभ्यास किए गए प्रश्न",
  "progress.sessions": "सत्र",
  "progress.totalSessions": "कुल सत्र",
  "progress.totalMessages": "कुल पूछे गए प्रश्न",
  "progress.note": "दक्षता VidyaGanit पर अभ्यास के आधार पर एक अनुमान है, कोई औपचारिक परीक्षा अंक नहीं।",
  "progress.empty.title": "अभी कोई अभ्यास नहीं",
  "progress.empty.hint": "जब आपका बच्चा गणित के प्रश्न पूछना शुरू करेगा, उनकी प्रगति यहाँ दिखेगी।",
  "progress.loading": "प्रगति लोड हो रही है…",

  "history.title": "सहेजा गया सॉक्रेटिक इतिहास",
  "history.subtitle": "आपके बच्चे की ट्यूशन बातचीत के पूरे रिकॉर्ड।",
  "history.session": "सत्र",
  "history.messages": "संदेश",
  "history.student": "छात्र",
  "history.tutor": "शिक्षक",
  "history.empty.title": "अभी तक कोई बातचीत नहीं",
  "history.empty.hint": "आपके बच्चे की सहेजी गई ट्यूशन चैट यहाँ दिखेगी जब वे सीखना शुरू करेंगे।",
  "history.loading": "इतिहास लोड हो रहा है…",

  "strategy.title": "रणनीति AI से पूछें",
  "strategy.subtitle": "आपके बच्चे की गणित सीखने में मदद के लिए आपका निजी सलाहकार।",
  "strategy.placeholder": "पूछें कि अपने बच्चे की मदद कैसे करें…",
  "strategy.send": "भेजें",
  "strategy.about": "इनके बारे में सलाह",
  "strategy.general": "सामान्य सलाह",
  "strategy.clear": "चैट साफ़ करें",
  "strategy.listening": "सुन रहा है…",
  "strategy.transcribing": "लिखा जा रहा है…",
  "strategy.recording": "रिकॉर्ड हो रहा है… रोकने के लिए टैप करें",
  "strategy.micUnsupported": "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। कृपया टाइप करें।",
  "strategy.attach": "फ़ाइल संलग्न करें",
  "strategy.camera": "फ़ोटो लें",
  "strategy.welcome":
    "नमस्ते! मैं आपका रणनीति AI सलाहकार हूँ। अपने बच्चे की गणित सीखने में मदद के बारे में कुछ भी पूछें — दैनिक दिनचर्या, आत्मविश्वास बढ़ाना, या कठिन विषय। ऊपर एक बच्चा चुनें और मैं उनकी प्रगति के अनुसार सलाह दूँगा।",
  "strategy.error": "क्षमा करें, कनेक्ट करने में समस्या हुई। कृपया फिर प्रयास करें।",
  "strategy.fileTooBig": "वह फ़ाइल बहुत बड़ी है! कृपया 8 MB से छोटी फ़ाइल चुनें।",
};

const te: Dict = {
  "dashboard.title": "తల్లిదండ్రుల డాష్‌బోర్డ్",
  "language.label": "భాష",

  "tab.profile": "నా ప్రొఫైల్",
  "tab.progress": "పురోగతి",
  "tab.history": "చరిత్ర",
  "tab.strategy": "వ్యూహ AI",

  "profile.edit": "ప్రొఫైల్ సవరించు",
  "profile.changePassword": "పాస్‌వర్డ్ మార్చు",
  "profile.relationship": "సంబంధం",
  "profile.gender": "లింగం",
  "profile.contact": "సంప్రదింపు",
  "profile.notProvided": "ఇవ్వలేదు",
  "profile.father": "తండ్రి",
  "profile.mother": "తల్లి",
  "profile.male": "పురుషుడు",
  "profile.female": "స్త్రీ",
  "profile.connectedStudents": "అనుసంధానించిన విద్యార్థులు",
  "profile.linked": "అనుసంధానం",
  "profile.linkPlaceholder": "విద్యార్థి VidyaGanit ID నమోదు చేయండి (ఉదా. VG-STU-12345)",
  "profile.link": "అనుసంధానించు",
  "profile.noStudentsTitle": "ఇంకా విద్యార్థులు అనుసంధానం కాలేదు",
  "profile.noStudentsHint": "మీ పిల్లల VidyaGanit ID ను పైన నమోదు చేసి ఖాతాను అనుసంధానించండి.",
  "profile.class": "తరగతి",
  "profile.removeStudent": "విద్యార్థిని తొలగించు",

  "picker.label": "చూస్తున్నారు",
  "picker.placeholder": "ఒక పిల్లవాడిని ఎంచుకోండి",
  "picker.empty.title": "ఇంకా పిల్లలు అనుసంధానం కాలేదు",
  "picker.empty.hint": "నా ప్రొఫైల్‌కు వెళ్లి మీ పిల్లల VidyaGanit ID ను అనుసంధానించండి.",

  "progress.title": "పురోగతి విశ్లేషణ",
  "progress.subtitle": "మీ పిల్లవాడు ప్రతి అంశంతో ఎలా నిమగ్నమవుతున్నాడో.",
  "progress.mastery": "ప్రావీణ్యం",
  "progress.questions": "సాధన చేసిన ప్రశ్నలు",
  "progress.sessions": "సెషన్లు",
  "progress.totalSessions": "మొత్తం సెషన్లు",
  "progress.totalMessages": "అడిగిన మొత్తం ప్రశ్నలు",
  "progress.note": "ప్రావీణ్యం VidyaGanit సాధన ఆధారంగా ఒక అంచనా, అధికారిక పరీక్ష స్కోరు కాదు.",
  "progress.empty.title": "ఇంకా సాధన లేదు",
  "progress.empty.hint": "మీ పిల్లవాడు గణిత ప్రశ్నలు అడగడం మొదలుపెట్టాక పురోగతి ఇక్కడ కనిపిస్తుంది.",
  "progress.loading": "పురోగతి లోడ్ అవుతోంది…",

  "history.title": "సేవ్ చేసిన సోక్రటిక్ చరిత్ర",
  "history.subtitle": "మీ పిల్లల ట్యూషన్ సంభాషణల పూర్తి రికార్డులు.",
  "history.session": "సెషన్",
  "history.messages": "సందేశాలు",
  "history.student": "విద్యార్థి",
  "history.tutor": "ఉపాధ్యాయుడు",
  "history.empty.title": "ఇంకా సంభాషణలు లేవు",
  "history.empty.hint": "మీ పిల్లవాడు నేర్చుకోవడం మొదలుపెట్టాక సేవ్ చేసిన చాట్‌లు ఇక్కడ కనిపిస్తాయి.",
  "history.loading": "చరిత్ర లోడ్ అవుతోంది…",

  "strategy.title": "వ్యూహ AI ను అడగండి",
  "strategy.subtitle": "మీ పిల్లల గణిత అభ్యాసానికి మద్దతు ఇచ్చే మీ వ్యక్తిగత సలహాదారు.",
  "strategy.placeholder": "మీ పిల్లవాడికి ఎలా సహాయం చేయాలో అడగండి…",
  "strategy.send": "పంపు",
  "strategy.about": "వీరి గురించి సలహా",
  "strategy.general": "సాధారణ సలహా",
  "strategy.clear": "చాట్ క్లియర్ చేయి",
  "strategy.listening": "వింటోంది…",
  "strategy.transcribing": "లిప్యంతరీకరణ…",
  "strategy.recording": "రికార్డ్ అవుతోంది… ఆపడానికి నొక్కండి",
  "strategy.micUnsupported": "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. దయచేసి టైప్ చేయండి.",
  "strategy.attach": "ఫైల్ జతచేయి",
  "strategy.camera": "ఫోటో తీయి",
  "strategy.welcome":
    "నమస్తే! నేను మీ వ్యూహ AI సలహాదారుని. మీ పిల్లల గణిత అభ్యాసానికి మద్దతు గురించి ఏదైనా అడగండి — రోజువారీ అలవాట్లు, ఆత్మవిశ్వాసం పెంచడం, లేదా కష్టమైన అంశాలు. పైన ఒక పిల్లవాడిని ఎంచుకోండి, వారి పురోగతికి తగ్గట్టు సలహా ఇస్తాను.",
  "strategy.error": "క్షమించండి, కనెక్ట్ చేయడంలో సమస్య. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "strategy.fileTooBig": "ఆ ఫైల్ చాలా పెద్దది! దయచేసి 8 MB కంటే తక్కువ ఫైల్ ఎంచుకోండి.",
};

const DICTS: Record<Language, Dict> = { en, ta, hi, te };

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStored(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ta" || stored === "hi" || stored === "te") return stored;
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStored);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, []);

  const t = useCallback(
    (key: string): string => DICTS[lang][key] ?? en[key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
