import sinon from 'sinon';
import referee from 'referee';
import formatio from 'formatio';
import refSin from 'referee-sinon';
import 'babel-polyfill';

sinon.format = formatio.ascii;
referee.format = formatio.ascii;
refSin(referee, sinon);

export {sinon};
export const assert = referee.assert;
export const refute = referee.refute;
