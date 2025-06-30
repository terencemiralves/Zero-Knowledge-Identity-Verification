pragma circom 2.1.4;

include "circomlib/circuits/comparators.circom";

// Utility: Parses a date string (yyyy-mm-dd) from ASCII codes into year, month, day numbers
template ParseDate() {
    signal input dob[10]; // ASCII codes
    signal output year;
    signal output month;
    signal output day;

    year <== (dob[0] - 48) * 1000 +
             (dob[1] - 48) * 100 +
             (dob[2] - 48) * 10 +
             (dob[3] - 48);

    month <== (dob[5] - 48) * 10 +
              (dob[6] - 48);

    day <== (dob[8] - 48) * 10 +
            (dob[9] - 48);
}

template Is18Plus(referenceYear, referenceMonth, referenceDay) {
    signal input dob[10];
    signal output is18plus;

    // Parse DOB
    component pd = ParseDate();
    for (var i = 0; i < 10; i++) {
        pd.dob[i] <== dob[i];
    }

    // Compute age
    signal age;
    age <== referenceYear - pd.year;

    // age > 18
    component lt_age = LessThan(8);
    lt_age.in[0] <== 18;
    lt_age.in[1] <== age;

    // age == 18
    signal isExactly18;
    isExactly18 <== 1 - ((age - 18)*(age - 18));

    // referenceMonth > month
    component lt_month = LessThan(5);
    lt_month.in[0] <== pd.month;
    lt_month.in[1] <== referenceMonth;

    // referenceMonth == month
    signal isMonthEqual;
    isMonthEqual <== 1 - ((referenceMonth - pd.month)*(referenceMonth - pd.month));

    // referenceDay >= day: referenceDay + 1 > day
    component lt_day = LessThan(6);
    lt_day.in[0] <== pd.day;
    lt_day.in[1] <== referenceDay + 1;

    // (referenceMonth == month) AND (referenceDay >= day)
    signal monthEqAndDayOK;
    monthEqAndDayOK <== isMonthEqual * lt_day.out;

    // (referenceMonth > month) OR ((referenceMonth == month) AND (referenceDay >= day))
    // Use A + B - (A * B)
    signal monthOrDayOK;
    monthOrDayOK <== lt_month.out + monthEqAndDayOK - (lt_month.out * monthEqAndDayOK);

    // age == 18 AND (monthOrDayOK)
    signal age18full;
    age18full <== isExactly18 * monthOrDayOK;

    // (age > 18) OR [age == 18 && (month/day)]
    // Use A + B - (A * B)
    is18plus <== lt_age.out + age18full - (lt_age.out * age18full);
}

template Main() {
    signal input name[16];
    signal input surname[16];
    signal input dob[10];

    signal output is18plus;

    var refYear = 2025;
    var refMonth = 6;
    var refDay = 29;

    component check = Is18Plus(refYear, refMonth, refDay);
    for (var i = 0; i < 10; i++) {
        check.dob[i] <== dob[i];
    }

    is18plus <== check.is18plus;
}

component main = Main();
