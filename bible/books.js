// The 66 books of the Protestant canon: [USFM code (as YouVersion uses), name, chapters, testament].
window.BIBLE_BOOKS = [
  ["GEN", "Genesis", 50, "OT"], ["EXO", "Exodus", 40, "OT"], ["LEV", "Leviticus", 27, "OT"],
  ["NUM", "Numbers", 36, "OT"], ["DEU", "Deuteronomy", 34, "OT"], ["JOS", "Joshua", 24, "OT"],
  ["JDG", "Judges", 21, "OT"], ["RUT", "Ruth", 4, "OT"], ["1SA", "1 Samuel", 31, "OT"],
  ["2SA", "2 Samuel", 24, "OT"], ["1KI", "1 Kings", 22, "OT"], ["2KI", "2 Kings", 25, "OT"],
  ["1CH", "1 Chronicles", 29, "OT"], ["2CH", "2 Chronicles", 36, "OT"], ["EZR", "Ezra", 10, "OT"],
  ["NEH", "Nehemiah", 13, "OT"], ["EST", "Esther", 10, "OT"], ["JOB", "Job", 42, "OT"],
  ["PSA", "Psalms", 150, "OT"], ["PRO", "Proverbs", 31, "OT"], ["ECC", "Ecclesiastes", 12, "OT"],
  ["SNG", "Song of Songs", 8, "OT"], ["ISA", "Isaiah", 66, "OT"], ["JER", "Jeremiah", 52, "OT"],
  ["LAM", "Lamentations", 5, "OT"], ["EZK", "Ezekiel", 48, "OT"], ["DAN", "Daniel", 12, "OT"],
  ["HOS", "Hosea", 14, "OT"], ["JOL", "Joel", 3, "OT"], ["AMO", "Amos", 9, "OT"],
  ["OBA", "Obadiah", 1, "OT"], ["JON", "Jonah", 4, "OT"], ["MIC", "Micah", 7, "OT"],
  ["NAM", "Nahum", 3, "OT"], ["HAB", "Habakkuk", 3, "OT"], ["ZEP", "Zephaniah", 3, "OT"],
  ["HAG", "Haggai", 2, "OT"], ["ZEC", "Zechariah", 14, "OT"], ["MAL", "Malachi", 4, "OT"],
  ["MAT", "Matthew", 28, "NT"], ["MRK", "Mark", 16, "NT"], ["LUK", "Luke", 24, "NT"],
  ["JHN", "John", 21, "NT"], ["ACT", "Acts", 28, "NT"], ["ROM", "Romans", 16, "NT"],
  ["1CO", "1 Corinthians", 16, "NT"], ["2CO", "2 Corinthians", 13, "NT"], ["GAL", "Galatians", 6, "NT"],
  ["EPH", "Ephesians", 6, "NT"], ["PHP", "Philippians", 4, "NT"], ["COL", "Colossians", 4, "NT"],
  ["1TH", "1 Thessalonians", 5, "NT"], ["2TH", "2 Thessalonians", 3, "NT"], ["1TI", "1 Timothy", 6, "NT"],
  ["2TI", "2 Timothy", 4, "NT"], ["TIT", "Titus", 3, "NT"], ["PHM", "Philemon", 1, "NT"],
  ["HEB", "Hebrews", 13, "NT"], ["JAS", "James", 5, "NT"], ["1PE", "1 Peter", 5, "NT"],
  ["2PE", "2 Peter", 3, "NT"], ["1JN", "1 John", 5, "NT"], ["2JN", "2 John", 1, "NT"],
  ["3JN", "3 John", 1, "NT"], ["JUD", "Jude", 1, "NT"], ["REV", "Revelation", 22, "NT"],
];

// Extra spellings people type or cite (beyond the full name, its prefixes, and the code).
window.BIBLE_ALIASES = {
  ex: "EXO", exod: "EXO", dt: "DEU", deut: "DEU", josh: "JOS", judg: "JDG", jdg: "JDG",
  psalm: "PSA", ps: "PSA", pss: "PSA", prov: "PRO", eccl: "ECC", qoh: "ECC",
  song: "SNG", sos: "SNG", songofsolomon: "SNG", canticles: "SNG",
  ezek: "EZK", ezk: "EZK", joel: "JOL", obad: "OBA", nah: "NAM", zeph: "ZEP", zech: "ZEC",
  mt: "MAT", matt: "MAT", mk: "MRK", mrk: "MRK", lk: "LUK", jn: "JHN", jhn: "JHN",
  phil: "PHP", php: "PHP", phlm: "PHM", jas: "JAS", jude: "JUD", rev: "REV", revelations: "REV",
  "1jn": "1JN", "2jn": "2JN", "3jn": "3JN", "1pet": "1PE", "2pet": "2PE",
  "1thess": "1TH", "2thess": "2TH", "1tim": "1TI", "2tim": "2TI", "1cor": "1CO", "2cor": "2CO",
  "1sam": "1SA", "2sam": "2SA", "1kgs": "1KI", "2kgs": "2KI", "1chr": "1CH", "2chr": "2CH",
};
