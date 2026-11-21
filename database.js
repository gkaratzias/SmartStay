const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'smartstay.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Execute Schema DDL
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

// Helper Query Execution
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

function queryGet(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
}

function execute(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
}

function runScript(sql) {
    return db.exec(sql);
}

// Seed initial data if empty
function seedDataIfEmpty() {
    const propCount = queryGet('SELECT COUNT(*) as count FROM properties').count;
    if (propCount === 0) {
        console.log('Seeding initial SQL database tables...');

        // 1. Properties
        const insertProp = db.prepare(`
            INSERT INTO properties (id, name, location, lock_id, locked, battery, power_on, guest, pin, check_out, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertProp.run('prop-1', 'Στούντιο Κέντρο #101', 'Κέντρο, 2ος Όροφος', 'TTL-40192', 1, 92, 1, 'Maria Rossi (Airbnb)', '482910', '24/11 11:00', 'Airbnb');
        insertProp.run('prop-2', 'Πολυτελές Διαμέρισμα Παραλία #202', 'Παραλιακή, 4ος Όροφος', 'TTL-40198', 1, 84, 1, 'Lukas Weber (Booking)', '739104', '23/11 11:00', 'Booking.com');
        insertProp.run('prop-3', 'Μεζονέτα Παλιά Πόλη #303', 'Παλιά Πόλη, Ισόγειο', 'TTL-40215', 1, 22, 0, 'Κενό (Standby Eco)', '------', 'Επόμενο: 22/11', 'Vrbo');
        insertProp.run('prop-4', 'Διαμέρισμα Ακρόπολη #404', 'Κουκάκι, 3ος Όροφος', 'TTL-40289', 0, 96, 1, 'Sophia Chen (Airbnb)', '915042', '26/11 11:00', 'Airbnb');

        // 2. Lockers Box A
        const insertLocker = db.prepare(`
            INSERT INTO lockers (box_id, box_name, slot, room, status, guest, source, pin, validity, door_open)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const boxASlots = [
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '01', 'Διαμέρισμα #101', 'key_inside', 'Maria Rossi', 'Airbnb', '519204', 'Σήμερα 15:00 - 24/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '02', 'Διαμέρισμα #102', 'picked_up', 'Lukas Weber', 'Booking.com', '830192', 'Ενεργό έως 23/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '03', 'Διαμέρισμα #103', 'key_inside', 'Sophia Chen', 'Airbnb', '642910', 'Σήμερα 16:00 - 26/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '04', 'Διαμέρισμα #104', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '05', 'Στούντιο #201', 'key_inside', 'David Miller', 'Vrbo', '294810', 'Αύριο 15:00 - 27/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '06', 'Στούντιο #202', 'picked_up', 'Claire Dubois', 'Airbnb', '771039', 'Ενεργό έως 25/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '07', 'Σουίτα #301', 'key_inside', 'Μαρία Κ. (Καθαρισμός)', 'Προσωπικό', '112299', 'Καθημερινά 11:00-15:00', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '08', 'Σουίτα #302', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '09', 'Loft #401', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '10', 'Loft #402', 'key_inside', 'Marco Bellini', 'Booking.com', '905128', '23/11 15:00 - 28/11', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '11', 'Master Key (Έκτακτο)', 'key_inside', 'Γιώργος Τ. (Τεχνικός)', 'Προσωπικό', '558800', '24/7 Εφεδρικό', 0],
            ['boxA', 'Reception Kiosk A — Κεντρική Είσοδος', '12', 'Penthouse #501', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0]
        ];

        for (const item of boxASlots) {
            insertLocker.run(...item);
        }

        // Lockers Box B
        const boxBSlots = [
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B1', 'Bungalow #01', 'key_inside', 'Hannah Klein', 'Airbnb', '348921', 'Σήμερα 15:00 - 25/11', 0],
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B2', 'Bungalow #02', 'picked_up', 'Thomas Lindqvist', 'Booking.com', '619402', 'Ενεργό έως 24/11', 0],
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B3', 'Bungalow #03', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0],
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B4', 'Bungalow #04', 'key_inside', 'Elena Novak', 'Vrbo', '482019', '24/11 15:00 - 29/11', 0],
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B5', 'Bungalow #05', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0],
            ['boxB', 'Modular Keybox Wall B — Είσοδος Πτέρυγας', 'B6', 'Bungalow #06', 'free', '—', '—', '------', 'Έτοιμο για ανάθεση', 0]
        ];

        for (const item of boxBSlots) {
            insertLocker.run(...item);
        }

        // 3. Bookings
        const insertBooking = db.prepare(`
            INSERT INTO bookings (id, guest, property_name, source, dates, pin, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertBooking.run('BK-101', 'Maria Rossi', 'Στούντιο Κέντρο #101', 'Airbnb', '20/11 15:00 → 24/11 11:00', '482910', 'Στάλθηκε WhatsApp');
        insertBooking.run('BK-102', 'Lukas Weber', 'Πολυτελές Διαμέρισμα Παραλία #202', 'Booking.com', '19/11 15:00 → 23/11 11:00', '739104', 'Στάλθηκε SMS & Email');
        insertBooking.run('BK-103', 'Sophia Chen', 'Διαμέρισμα Ακρόπολη #404', 'Airbnb', '21/11 14:00 → 26/11 11:00', '915042', 'Στάλθηκε WhatsApp');
        insertBooking.run('BK-104', 'David Miller', 'Μεζονέτα Παλιά Πόλη #303', 'Vrbo', '22/11 15:00 → 27/11 11:00', '604819', 'Προγραμματισμένο');
        insertBooking.run('BK-105', 'Elena Novak', 'Στούντιο Κέντρο #101', 'Booking.com', '24/11 15:00 → 28/11 11:00', '318592', 'Προγραμματισμένο');

        // 4. Staff
        const insertStaff = db.prepare(`
            INSERT INTO staff (id, name, pin, schedule, properties, active)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertStaff.run('ST-1', 'Μαρία Κ. — Υπεύθυνη Καθαριότητας', '112299', 'Καθημερινά • 11:00 - 15:30', 'Όλα τα Καταλύματα', 1);
        insertStaff.run('ST-2', 'Γιώργος Τ. — Τεχνικός A/C & Υδραυλικά', '558800', 'Μόνιμος Κωδικός Έκτακτης Ανάγκης', 'Όλα τα Καταλύματα', 1);
        insertStaff.run('ST-3', 'Ανδρέας Π. — Συνεργείο Λευκών Ειδών', '774411', 'Τρίτη & Παρασκευή • 10:00 - 14:00', 'Παραλία #202, Κέντρο #101', 0);

        // 5. Audit Logs
        const insertLog = db.prepare(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, ?)
        `);

        insertLog.run('Διαμέρισμα Ακρόπολη #404', 'Ξεκλείδωμα πόρτας με PIN Επισκέπτη (#915042)', 'unlock');
        insertLog.run('Πολυτελές Διαμέρισμα Παραλία #202', 'Αισθητήρας μπαλκονόπορτας ανοιχτός >60s -> Αυτόματο σβήσιμο A/C', 'energy');
        insertLog.run('Στούντιο Κέντρο #101', 'Είσοδος επισκέπτη Maria Rossi (Check-in επιβεβαιώθηκε)', 'unlock');
        insertLog.run('Μεζονέτα Παλιά Πόλη #303', 'Είσοδος Προσωπικού Καθαριότητας (Μαρία Κ. - PIN #112299)', 'staff');
        insertLog.run('Μεζονέτα Παλιά Πόλη #303', 'Αυτόματη διακοπή θερμοσίφωνα & A/C μετά το Check-out (Ραγοδιακόπτης)', 'energy');

        // 6. Default Settings
        const insertSetting = db.prepare(`
            INSERT INTO settings (key, value)
            VALUES (?, ?)
        `);

        insertSetting.run('brand_name', 'SmartStay Pro');
        insertSetting.run('client_name', 'Νίκος Παπαδόπουλος');
        insertSetting.run('client_company', 'Aegean Stays Management');
        insertSetting.run('client_plan', 'Pro Multi-Property');
        insertSetting.run('plan_limit', '5');

        // 7. Initial Demo Quote
        const insertQuote = db.prepare(`
            INSERT INTO quotes (full_name, phone, email, package_name, notes)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertQuote.run('Γιάννης Δημητρίου', '6971234567', 'j.dimitriou@athensvillas.gr', 'Pro Energy & Access (650€)', '3 διαμερίσματα στην Πλάκα, πόρτες ασφαλείας Dierre');

        console.log('SQL Database initialized and seeded successfully.');
    }
}

seedDataIfEmpty();

module.exports = {
    db,
    queryAll,
    queryGet,
    execute,
    runScript
};
