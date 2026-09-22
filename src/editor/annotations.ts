import { Annotation } from '@codemirror/state';

/** Marks changes that came from Dropbox rather than your typing. */
export const External = Annotation.define<boolean>();
