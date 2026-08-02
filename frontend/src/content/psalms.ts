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
    description: 'The complete prayer for mercy, a clean heart, and a renewed spirit.',
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
      },
      {
        number: 4,
        scriptText: 'ብዘረባኻ ጻድቕ፣ ብፍርድኻውን ንጹህ ኴንካ ኽትርከብሲ፣ ኣነ ንኣኻ ጥራይ በደልኩ፣ ኣብ ቅድሜኻ እከይ ገበርኩ።',
        englishText: 'Against you, and you only, I have sinned, and done that which is evil in your sight, so you may be proved right when you speak, and justified when you judge.',
        pronunciation: 'Bezerebakha tsadik; befrdikha-wun nitsuh kwenka kitirkebsi; ane ne-akha tiray bedelku; ab kidmekha ikey geberku.'
      },
      {
        number: 5,
        scriptText: 'እንሆ፣ ብአበሳ ተወለድኩ፣ እኖይ ከኣ ብሓጢኣት ጠነሰትኒ።',
        englishText: 'Behold, I was born in iniquity. My mother conceived me in sin.',
        pronunciation: "Inho, be-abesa teweledku; inoy ke-a behati'at tenesetni."
      },
      {
        number: 6,
        scriptText: 'እንሆ፡ ንሓቂ ኣብ ውሽጢ ኢኻ እትደልዮ፡ ኣብ ሕቡእውን ጥበብ ምሀረኒ።',
        englishText: 'Behold, you desire truth in the inward parts. You teach me wisdom in the inmost place.',
        pronunciation: "Inho, nihaki ab wishti ikha itideliyo; ab hibu-i-wun tibeb mihareni."
      },
      {
        number: 7,
        scriptText: 'ምእንቲ ኽጸርስ፣ ብስምዕዛ ኣጽርየኒ፣ ካብ በረድ ክጽዕዱ፣ ሕጸበኒ።',
        englishText: 'Purify me with hyssop, and I will be clean. Wash me, and I will be whiter than snow.',
        pronunciation: "Me-enti kitseris, besim-iza atsriyeni; kab bered kitsi-idu, hitsebeni."
      },
      {
        number: 8,
        scriptText: 'እተን ዝቐጥቀጥካየን ኣዕጽምቲ ኺሕጐሳስ፣ ባህታን ሓጐስን ኣስምዓኒ።',
        englishText: 'Let me hear joy and gladness, that the bones which you have broken may rejoice.',
        pronunciation: "Iten ziketiketkayen a-itsimti kihigosas; bahtan hagosin asmi-ani."
      },
      {
        number: 9,
        scriptText: 'ገጽካ ኻብ ሓጢኣተይ ከውሎ፣ ንብዘሎ ኣበሳይውን ደምስሶ።',
        englishText: 'Hide your face from my sins, and blot out all of my iniquities.',
        pronunciation: "Getskha kab hati'atey kewlo; nibizelo abesay-wun demseso."
      },
      {
        number: 10,
        scriptText: 'ዎ ኣምላኽ፣ ጽሩይ ልቢ ፍጠረለይ፣ ጽኑዕ መንፈስ ከኣ ኣብ ውሽጠይ ሐድስ።',
        englishText: 'Create in me a clean heart, O God. Renew a right spirit within me.',
        pronunciation: 'Wo Amlakh, tsiruy libi fitereley; tsinu-i menfes ke-a ab wishtay hades.'
      },
      {
        number: 11,
        scriptText: 'ካብ ገጽካ ኣይትደርብየኒ፣ ቅዱስ መንፈስካውን ኣይተግድፈኒ።',
        englishText: "Don't throw me from your presence, and don't take your Holy Spirit from me.",
        pronunciation: 'Kab getskha aytiderbiyeni; kidus menfeskha-wun aytegdefeni.'
      },
      {
        number: 12,
        scriptText: 'ሓጐስ ምድሓንካ ምለሰለይ፣ ብፍቓደኛ መንፈስውን ደግፈኒ።',
        englishText: 'Restore to me the joy of your salvation. Uphold me with a willing spirit.',
        pronunciation: 'Hagos midhankha mileseley; befikadenya menfes-wun degfeni.'
      },
      {
        number: 13,
        scriptText: 'መገድኻ ንመፍረስቲ ኽምህሮም እየ፣ ሓጥኣን ከኣ ናባኻ ኺምለሱ እዮም።',
        englishText: 'Then I will teach transgressors your ways. Sinners will be converted to you.',
        pronunciation: "Megedkha nimefresti kimhirom iye; hati-an ke-a nabakha kimelesu iyom."
      },
      {
        number: 14,
        scriptText: 'ዎ ኣምላኽ፣ ኣምላኽ ምድሓነይ፣ ካብ ዕዳ ደም ኣናግፈኒ፣ ልሳነይውን ንጽድቅኻ እልል ክትብለሉ እያ።',
        englishText: 'Deliver me from the guilt of bloodshed, O God, the God of my salvation. My tongue will sing aloud of your righteousness.',
        pronunciation: 'Wo Amlakh, Amlakh midhaney, kab ida dem anagfeni; lisaney-wun nitsidkikha ilil kitiblelu iya.'
      },
      {
        number: 15,
        scriptText: 'ጐይታየ፣ ኣፈይ ምስጋናኻ ኺነግርሲ፣ ከናፍረይ ክፈት።',
        englishText: 'Lord, open my lips. My mouth will declare your praise.',
        pronunciation: 'Goyitaye, afey misganakha kinegirsi; kenafrey kifet.'
      },
      {
        number: 16,
        scriptText: 'መስዋእቲ ባህ ኣየብለካን እዩ፣ እንተ ዘይኰነስ መቕረብኩልካ ነይረ፣ ንመስዋእቲ ምሕራር ኣይትብህጎን ኢኻ እሞ፣',
        englishText: "For you don't delight in sacrifice, or else I would give it. You have no pleasure in burnt offering.",
        pronunciation: 'Meswa-iti bah ayebilekhan iyu; inte zeykones mekrebkulkha neyire; nimeswa-iti mihirar aytibihgon ikha emo.'
      },
      {
        number: 17,
        scriptText: 'መስዋእቲ ኣምላኽ ስቡር መንፈስ እዩ። ዎ ኣምላኽ፣ ንስቡርን ቅጥቁጥን ልቢ ኣይትንዕቆን ኢኻ።',
        englishText: 'The sacrifices of God are a broken spirit. O God, you will not despise a broken and contrite heart.',
        pronunciation: "Meswa-iti Amlakh sibur menfes iyu. Wo Amlakh, nisiburin kitikutin libi aytin-ikon ikha."
      },
      {
        number: 18,
        scriptText: 'ንጽዮን ብጸጋኻ ሰናይ ግበረላ፣ መካበብያታት ኢየሩሳሌም ንደቕ።',
        englishText: 'Do well in your good pleasure to Zion. Build the walls of Jerusalem.',
        pronunciation: 'Nitsiyon betsegakha senay gibirela; mekabebiyatat Iyerusalem nidek.'
      },
      {
        number: 19,
        scriptText: 'ሽዑ ብመስዋእቲ ጽድቂ፣ ብዚሐርር መስዋእቲ፣ ብምሉእ መስዋእቲ ባህ ኪብለካ እዩ፣ ሽዑ ኣብ መሰውኢኻ ኣራሑ ኬቕርቡልካ እዮም።',
        englishText: 'Then you will delight in the sacrifices of righteousness, in burnt offerings and in whole burnt offerings. Then they will offer bulls on your altar.',
        pronunciation: 'Shi-u bemeswa-iti tsidki, beziharrer meswa-iti, bemulu-i meswa-iti bah kibelekha iyu; shi-u ab mesewi-ikha arahu kekribulkha iyom.'
      }
    ]
  }
];

export const getPsalm = (number: number) => PSALMS.find((psalm) => psalm.number === number);
