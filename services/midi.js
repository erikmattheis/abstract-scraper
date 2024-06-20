const MidiWriter = require("midi-writer-js");
const fs = require("fs");

// Create four new tracks
let chordTrack = new MidiWriter.Track();
let melodyTrack = new MidiWriter.Track();
let drumTrack = new MidiWriter.Track();
let bassTrack = new MidiWriter.Track();

// Set the drum track to use channel 10 (percussion)
drumTrack.addEvent(
  new MidiWriter.ProgramChangeEvent({ instrument: 0, channel: 9 })
);

// Define the chords - Dm7 (D-F-A-C), G7 (G-B-D-F), and Cmaj7 (C-E-G-B)
let chords = [
  { pitch: [62, 65, 69, 72], duration: "4" }, // Dm7 quarter note
  { pitch: [62, 65, 69, 72], duration: "4" }, // Dm7 quarter note
  { pitch: [67, 71, 74, 77], duration: "4" }, // G7 quarter note
  { pitch: [67, 71, 74, 77], duration: "4" }, // G7 quarter note
  { pitch: [60, 64, 67, 71], duration: "2" }, // Cmaj7 half note
  { pitch: [60, 64, 67, 71], duration: "2" }, // Cmaj7 half note
];

// Repeat the chord progression to ensure a longer piece
chords = chords
  .concat(chords)
  .concat(chords)
  .concat(chords)
  .concat(chords)
  .concat(chords);

// Add chords to the chordTrack
chords.forEach((chord) => {
  chordTrack.addEvent(new MidiWriter.NoteEvent(chord));
});

// Define the melody - ensure it matches the length of the chord progression
let melody = [
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [72], duration: "2" }, // C half note
  { pitch: [71], duration: "2" }, // B half note
  { pitch: [69], duration: "8" }, // A eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "4" }, // C quarter note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "2" }, // C half note
  { pitch: [71], duration: "2" }, // B half note
  { pitch: [69], duration: "8" }, // A eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "4" }, // C quarter note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [71], duration: "8" }, // B eighth note
  { pitch: [72], duration: "8" }, // C eighth note
  { pitch: [74], duration: "8" }, // D eighth note
  { pitch: [76], duration: "4" }, // E quarter note
  { pitch: [77], duration: "8" }, // F eighth note
  { pitch: [76], duration: "8" }, // E eighth note
  { pitch: [74], duration: "4" }, // D quarter note
  { pitch: [72], duration: "2" }, // C half note
  { pitch: [71], duration: "2" }, // B half note
];

// Add melody to the melodyTrack
melody.forEach((note) => {
  melodyTrack.addEvent(new MidiWriter.NoteEvent(note));
});

// Define the bassline - a simple bassline that fits over the chords
let bassline = [
  { pitch: [50], duration: "4" }, // D quarter note
  { pitch: [50], duration: "4" }, // D quarter note
  { pitch: [43], duration: "4" }, // G quarter note
  { pitch: [43], duration: "4" }, // G quarter note
  { pitch: [48], duration: "2" }, // C half note
  { pitch: [48], duration: "2" }, // C half note
];

// Repeat the bassline to match the chord progression length
bassline = bassline
  .concat(bassline)
  .concat(bassline)
  .concat(bassline)
  .concat(bassline)
  .concat(bassline);

// Add bassline to the bassTrack
bassline.forEach((note) => {
  bassTrack.addEvent(new MidiWriter.NoteEvent(note));
});

// Define the Motown drum pattern
let drumPattern = [
  { pitch: [36, 42], duration: "4", channel: 9 }, // Bass drum and hi-hat on beat 1
  { pitch: [38, 42], duration: "4", channel: 9 }, // Snare drum and hi-hat on beat 2
  { pitch: [36, 42], duration: "4", channel: 9 }, // Bass drum and hi-hat on beat 3
  { pitch: [38, 42], duration: "4", channel: 9 }, // Snare drum and hi-hat on beat 4
  { pitch: [42], duration: "8", channel: 9 }, // Hi-hat eighth note
  { pitch: [42], duration: "8", channel: 9 }, // Hi-hat eighth note
  { pitch: [42], duration: "8", channel: 9 }, // Hi-hat eighth note
  { pitch: [42], duration: "8", channel: 9 }, // Hi-hat eighth note
];

// Repeat the drum pattern to match the chord progression length
let extendedDrumPattern = [];
for (let i = 0; i < chords.length / 2; i++) {
  extendedDrumPattern = extendedDrumPattern.concat(drumPattern);
}

// Add drum pattern to the drumTrack
extendedDrumPattern.forEach((note) => {
  drumTrack.addEvent(new MidiWriter.NoteEvent(note));
});

// Create a writer with all four tracks
let writer = new MidiWriter.Writer([
  chordTrack,
  melodyTrack,
  bassTrack,
  drumTrack,
]);

// Save the MIDI output to a file
let base64String = writer.dataUri().split(",")[1];
let midiData = Buffer.from(base64String, "base64");
fs.writeFileSync(
  "ii7_V7_IM7_Progression_With_Melody_Bass_Drums_Motown_Aligned.mid",
  midiData
);
