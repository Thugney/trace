// Curated, read-only Psalm content for the first family learning release.
export interface PsalmVerse {
  number: number;
  scriptText: string;
  englishText: string;
  pronunciation: string;
}

export interface PsalmSummary {
  number: number;
  tigrinyaTitle: string;
  englishTitle: string;
  theme: string;
  description: string;
  available: boolean;
  verses: PsalmVerse[];
}

export const PSALMS: PsalmSummary[] = [
  {
    number: 51,
    tigrinyaTitle: 'ዳዊት 51',
    englishTitle: 'Psalm 51',
    theme: 'Repentance and forgiveness',
    description: 'Ask God for mercy, a clean heart, and a renewed spirit.',
    available: true,
    verses: [
      {
        number: 1,
        scriptText: 'ዎ ኣምላኽ፣ ከም ሳህልኻ ምሐረኒ፣ ከምቲ ዓብዪ ርሕራሔኻ ኣበሳይ ደምስስ።',
        englishText: 'Have mercy on me, God, according to your loving kindness. According to the multitude of your tender mercies, blot out my transgressions.',
        pronunciation: 'Wo Amlakh, kem sahlkha mehareni; kemti abiyi rihrahekha, abesay demses.'
      },
      {
        number: 2,
        scriptText: 'ካብ ኣበሳይ ኣጸቢቕካ ሕጸበኒ፣ ካብ ሓጢኣተይውን ኣጽርየኒ።',
        englishText: 'Wash me thoroughly from my iniquity. Cleanse me from my sin.',
        pronunciation: "Kab abesay atsebikha hitsebeni; kab hati'ateywin atsriyeni."
      },
      {
        number: 3,
        scriptText: 'ኣነ ኣበሳይ እፈልጥ አሎኹ እሞ፣ ሓጢኣተይ ኵሉ ጊዜ ኣብ ቅድመይ እዩ።',
        englishText: 'For I know my transgressions. My sin is constantly before me.',
        pronunciation: "Ane abesay efelt alokhu emo; hati'atey kulu gize ab kidmey iyu."
      }
    ]
  },
  {
    number: 23,
    tigrinyaTitle: 'ዳዊት 23',
    englishTitle: 'Psalm 23',
    theme: 'Trust and comfort',
    description: 'Remember that God guides and cares for us.',
    available: false,
    verses: []
  },
  {
    number: 91,
    tigrinyaTitle: 'ዳዊት 91',
    englishTitle: 'Psalm 91',
    theme: 'Protection',
    description: 'Pray for refuge, courage, and protection.',
    available: false,
    verses: []
  },
  {
    number: 121,
    tigrinyaTitle: 'ዳዊት 121',
    englishTitle: 'Psalm 121',
    theme: 'Help and guidance',
    description: 'Look to God for help on every journey.',
    available: false,
    verses: []
  },
  {
    number: 130,
    tigrinyaTitle: 'ዳዊት 130',
    englishTitle: 'Psalm 130',
    theme: 'Forgiveness and hope',
    description: 'Wait for God with honesty and hope.',
    available: false,
    verses: []
  },
  {
    number: 150,
    tigrinyaTitle: 'ዳዊት 150',
    englishTitle: 'Psalm 150',
    theme: 'Praise',
    description: 'Finish with joyful praise and thanksgiving.',
    available: false,
    verses: []
  }
];

export const getPsalm = (number: number) => PSALMS.find((psalm) => psalm.number === number);
