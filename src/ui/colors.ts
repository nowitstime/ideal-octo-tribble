// One pastel per scale degree, used everywhere (chords, notes, progression).
export const DEGREE = ['#F2B9A2', '#EED9A0', '#C9DDB0', '#ABD8CC', '#AFC9EA', '#C8BCE9', '#EDB9CC'];
/** Deeper shade of each: "being touched / playing". */
export const DEGREE_ACTIVE = ['#E89C82', '#DDBF6C', '#A9C987', '#7FC2B1', '#86AEE0', '#A898DD', '#DE93AE'];

export const degreeColor = (d: number, active = false) => (active ? DEGREE_ACTIVE : DEGREE)[((d % 7) + 7) % 7];

/** Drum pads are coloured by family. */
const PAD_FAMILY = [0, 1, 1, 1, 3, 3, 3, 6, 4, 4, 4, 6, 5, 5, 5, 5];
export const padColor = (pad: number, active = false) => degreeColor(PAD_FAMILY[pad], active);

export const TRACK_COLOR = { drums: '#EED9A0', chords: '#C8BCE9', bass: '#AFC9EA', lead: '#ABD8CC' };
export const INK = '#1D1C1A';
export const REC = '#EC8F7E';
