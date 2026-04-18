export interface SoundSample {
  id: string;
  name: string;
  url: string;
  category: "kick" | "snare" | "hihat" | "perc" | "fx" | "lead" | "bass" | "pad";
  genre?: string[];
}

export const SOUND_LIBRARY: SoundSample[] = [
  // Kicks
  { id: "k-808", name: "808 Kick", url: "https://tonejs.github.io/audio/drum-samples/808/kick.mp3", category: "kick", genre: ["Trap", "Hip-Hop"] },
  { id: "k-tech", name: "Techno Kick", url: "https://tonejs.github.io/audio/drum-samples/909/kick.mp3", category: "kick", genre: ["Hard Techno", "Techno"] },
  { id: "k-crunch", name: "Crunch Kick", url: "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3", category: "kick", genre: ["Detroit", "Old School"] },
  
  // Snares
  { id: "s-808", name: "808 Snare", url: "https://tonejs.github.io/audio/drum-samples/808/snare.mp3", category: "snare", genre: ["Trap"] },
  { id: "s-tech", name: "Techno Snare", url: "https://tonejs.github.io/audio/drum-samples/909/snare.mp3", category: "snare", genre: ["Techno"] },
  { id: "s-clap", name: "Clap", url: "https://tonejs.github.io/audio/drum-samples/808/clap.mp3", category: "snare", genre: ["Hip-Hop", "Trap"] },
  
  // Hats
  { id: "h-cl", name: "Closed Hat", url: "https://tonejs.github.io/audio/drum-samples/808/hh.mp3", category: "hihat", genre: ["Trap", "Techno"] },
  { id: "h-op", name: "Open Hat", url: "https://tonejs.github.io/audio/drum-samples/909/hihat.mp3", category: "hihat", genre: ["Techno", "House"] },
  
  // Perc & FX
  { id: "pc-cow", name: "Cowbell", url: "https://tonejs.github.io/audio/drum-samples/808/cowbell.mp3", category: "perc", genre: ["Trap", "Detroit"] },
  { id: "pc-rim", name: "Rimshot", url: "https://tonejs.github.io/audio/drum-samples/CR78/rim.mp3", category: "perc", genre: ["Hip-Hop"] },

  // Melodic (Synths) - Using some free high quality loops or single shots if available
  // For now, using Tone.Synth usually works well for Piano Roll, but samples are better.
  { id: "b-sub", name: "Deep Sub", url: "https://tonejs.github.io/audio/casio/A1.mp3", category: "bass", genre: ["Trap", "DNB"] },
  { id: "l-detroit", name: "Detroit Lead", url: "https://tonejs.github.io/audio/casio/C2.mp3", category: "lead", genre: ["Detroit"] }
];

export const GENRES = ["Trap", "Hard Techno", "Boom Bap", "Detroit", "Drum & Bass"];
