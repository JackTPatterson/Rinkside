export const sort_by = (field, reverse, primer) => {

    const key = primer ?
        function (x) {
            return primer(x[field])
        } :
        function (x) {
            return x[field]
        };

    reverse = !reverse ? 1 : -1;

    return function (a, b) {
        return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    }
}

export const teamIdDictionary = {

    10: 5,
    6: 6,
    43: 7,
    51: 8,
    39: 9,
    3: 10,
    16: 11,
    17: 12,
    49: 13,
    26: 14,
    25: 15,
    4: 16,
    5: 17,
    19: 18,
    7: 19,
    23: 20,
    20: 21,
    2: 22,
    1: 23,
    15: 24,
    22: 25,
    12: 26,
    21: 27,
    28: 28,
    9: 29,
    14: 30,
    24: 31,
    13: 32,
    18: 34,
    52: 35,
    29: 36,
    30: 37,
    54: 38,
    55: 39
};

export function hyphenToCapitalizedWords(inputString) {
    return inputString.split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
