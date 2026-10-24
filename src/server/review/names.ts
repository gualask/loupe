import { randomInt } from 'node:crypto';

const ANIMALS = [
    'Badger',
    'Bison',
    'Crane',
    'Falcon',
    'Fox',
    'Gecko',
    'Heron',
    'Koala',
    'Lynx',
    'Moose',
    'Otter',
    'Owl',
    'Panda',
    'Puffin',
    'Raven',
    'Seal',
    'Tapir',
    'Wombat',
];

/** Name for a viewer who skipped choosing one, such as "Anonymous Fox". */
export function anonymousName() {
    return `Anonymous ${ANIMALS[randomInt(ANIMALS.length)]}`;
}
