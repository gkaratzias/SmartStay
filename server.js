const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { queryAll, queryGet, execute, runScript } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Route aliases
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ==========================================
// REST API ENDPOINTS (SQL BACKED)
// ==========================================

// 1. SYSTEM STATS & KPIS
app.get('/api/stats', (req, res) => {
    try {
        const propCount = queryGet('SELECT COUNT(*) as c FROM properties').c;
        const activePinsProps = queryGet("SELECT COUNT(*) as c FROM properties WHERE pin != '------'").c;
        const activePinsLockers = queryGet("SELECT COUNT(*) as c FROM lockers WHERE pin != '------'").c;
        const occupiedLockers = queryGet("SELECT COUNT(*) as c FROM lockers WHERE status != 'free'").c;
        const totalLockers = queryGet('SELECT COUNT(*) as c FROM lockers').c;
        const totalBookings = queryGet('SELECT COUNT(*) as c FROM bookings').c;
        const quotesCount = queryGet('SELECT COUNT(*) as c FROM quotes').c;

        res.json({
            properties: propCount,
            activePins: activePinsProps + activePinsLockers,
            lockers: {
                occupied: occupiedLockers,
                total: totalLockers
            },
            bookings: totalBookings,
            todayCheckins: 2,
            monthlySavingsEur: 486.00,
            monthlySavingsKwh: 1390,
            quotesCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. PROPERTIES (CRUD)
app.get('/api/properties', (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM properties ORDER BY created_at DESC');
        res.json(rows.map(r => ({
            ...r,
            locked: Boolean(r.locked),
            powerOn: Boolean(r.power_on),
            lockId: r.lock_id,
            checkOut: r.check_out
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/properties', (req, res) => {
    try {
        const { name, location, lockId, source } = req.body;
        if (!name || !location || !lockId) {
            return res.status(400).json({ error: 'Όνομα, τοποθεσία και Lock ID είναι υποχρεωτικά.' });
        }
        const id = `prop-${Date.now()}`;
        execute(`
            INSERT INTO properties (id, name, location, lock_id, locked, battery, power_on, guest, pin, check_out, source)
            VALUES (?, ?, ?, ?, 1, 100, 0, 'Κενό (Νέα Εγκατάσταση)', '------', 'Συγχρονισμένο', ?)
        `, [id, name, location, lockId, source || 'Airbnb']);

        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [name, `Προστέθηκε νέο κατάλυμα & συνδέθηκε η κλειδαριά ${lockId}`]);

        const created = queryGet('SELECT * FROM properties WHERE id = ?', [id]);
        res.status(201).json({
            ...created,
            locked: Boolean(created.locked),
            powerOn: Boolean(created.power_on),
            lockId: created.lock_id,
            checkOut: created.check_out
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/properties/:id/toggle-lock', (req, res) => {
    try {
        const prop = queryGet('SELECT * FROM properties WHERE id = ?', [req.params.id]);
        if (!prop) return res.status(404).json({ error: 'Το κατάλυμα δεν βρέθηκε.' });

        const newLocked = prop.locked ? 0 : 1;
        execute('UPDATE properties SET locked = ? WHERE id = ?', [newLocked, req.params.id]);

        const actionText = newLocked ? 'Κλείδωμα' : 'Απομακρυσμένο Ξεκλείδωμα';
        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [prop.name, `${actionText} μέσω Cloud Dashboard (Admin)`]);

        res.json({ success: true, locked: Boolean(newLocked), propertyName: prop.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/properties/:id/toggle-power', (req, res) => {
    try {
        const prop = queryGet('SELECT * FROM properties WHERE id = ?', [req.params.id]);
        if (!prop) return res.status(404).json({ error: 'Το κατάλυμα δεν βρέθηκε.' });

        const newPower = prop.power_on ? 0 : 1;
        execute('UPDATE properties SET power_on = ? WHERE id = ?', [newPower, req.params.id]);

        const state = newPower ? 'ON' : 'OFF';
        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'energy')
        `, [prop.name, `Ραγοδιακόπτης Πίνακα & A/C τέθηκε σε ${state} από διαχειριστή`]);

        res.json({ success: true, powerOn: Boolean(newPower), propertyName: prop.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. RECEPTION KEY LOCKERS
app.get('/api/lockers', (req, res) => {
    try {
        const allSlots = queryAll('SELECT * FROM lockers ORDER BY id ASC');
        const boxA = {
            id: 'boxA',
            name: 'Reception Kiosk A — Κεντρική Είσοδος',
            subtitle: 'Touchscreen Kiosk 10" + Ηλεκτρομαγνητικές κλειδαριές & αισθητήρες παρουσίας κλειδιού',
            meta: 'IP: 192.168.1.44 • Wi-Fi + 4G Failover • RFID Sensor Active',
            apiType: 'kiosk',
            slots: allSlots.filter(s => s.box_id === 'boxA').map(s => ({
                ...s,
                doorOpen: Boolean(s.door_open)
            }))
        };

        const boxB = {
            id: 'boxB',
            name: 'Modular Keybox Wall B — Είσοδος Πτέρυγας',
            subtitle: '6 Αυτόνομα Μεταλλικά Keyboxes TTLock συνδεδεμένα σε Wi-Fi Gateway G2',
            meta: 'Gateway: G2-8821 • BLE 5.0 + Wi-Fi • IP65 Αδιάβροχο',
            apiType: 'ttlock_box',
            slots: allSlots.filter(s => s.box_id === 'boxB').map(s => ({
                ...s,
                doorOpen: Boolean(s.door_open)
            }))
        };

        res.json({ boxA, boxB });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/lockers/assign', (req, res) => {
    try {
        const { boxId, slot, room, guest, source, validity } = req.body;
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();

        execute(`
            UPDATE lockers
            SET room = ?, guest = ?, source = ?, pin = ?, validity = ?, status = 'key_inside', updated_at = CURRENT_TIMESTAMP
            WHERE box_id = ? AND slot = ?
        `, [room, guest, source || 'Airbnb', newPin, validity || 'Σήμερα 15:00', boxId, slot]);

        const boxName = boxId === 'boxA' ? 'Reception Kiosk A' : 'Modular Keybox Wall B';
        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [boxName, `Ανάθεση Θυριδίου #${slot} (${room}) στον επισκέπτη ${guest} (PIN #${newPin})`]);

        res.json({ success: true, pin: newPin, slot, guest, room });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/lockers/unlock', (req, res) => {
    try {
        const { boxId, slot, triggeredBy } = req.body;
        const locker = queryGet('SELECT * FROM lockers WHERE box_id = ? AND slot = ?', [boxId, slot]);
        if (!locker) return res.status(404).json({ error: 'Το θυρίδιο δεν βρέθηκε.' });

        const newStatus = locker.status === 'key_inside' ? 'picked_up' : locker.status;
        execute(`
            UPDATE lockers
            SET status = ?, door_open = 1, updated_at = CURRENT_TIMESTAMP
            WHERE box_id = ? AND slot = ?
        `, [newStatus, boxId, slot]);

        const boxName = boxId === 'boxA' ? 'Reception Kiosk A' : 'Modular Keybox Wall B';
        const operator = triggeredBy || 'Admin Remote Open';
        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [boxName, `Άνοιγμα Θυριδίου #${slot} (${locker.room}) • ${operator}`]);

        // Automatically set door_open back to 0 in SQL after 4 seconds
        setTimeout(() => {
            try {
                execute('UPDATE lockers SET door_open = 0 WHERE box_id = ? AND slot = ?', [boxId, slot]);
            } catch (e) {}
        }, 4000);

        res.json({ success: true, slot, room: locker.room, status: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/lockers/release', (req, res) => {
    try {
        const { boxId, slot } = req.body;
        execute(`
            UPDATE lockers
            SET status = 'free', guest = '—', source = '—', pin = '------', validity = 'Έτοιμο για ανάθεση', door_open = 0, updated_at = CURRENT_TIMESTAMP
            WHERE box_id = ? AND slot = ?
        `, [boxId, slot]);

        res.json({ success: true, message: `Το θυρίδιο #${slot} απελευθερώθηκε.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/lockers/kiosk-submit', (req, res) => {
    try {
        const { boxId, pin } = req.body;
        if (!pin || pin.length < 6) {
            return res.status(400).json({ success: false, message: 'Εισάγετε έγκυρο 6-ψήφιο PIN.' });
        }

        const matchedSlot = queryGet('SELECT * FROM lockers WHERE box_id = ? AND pin = ?', [boxId || 'boxA', pin]);
        if (!matchedSlot) {
            return res.status(404).json({ success: false, message: 'Λάθος ή ληγμένος κωδικός PIN!' });
        }

        const newStatus = matchedSlot.status === 'key_inside' ? 'picked_up' : matchedSlot.status;
        execute(`
            UPDATE lockers
            SET status = ?, door_open = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [newStatus, matchedSlot.id]);

        const boxName = (boxId || 'boxA') === 'boxA' ? 'Reception Kiosk A' : 'Modular Keybox Wall B';
        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [boxName, `Άνοιγμα Θυριδίου #${matchedSlot.slot} (${matchedSlot.room}) • Guest Kiosk PIN (${matchedSlot.guest})`]);

        setTimeout(() => {
            try {
                execute('UPDATE lockers SET door_open = 0 WHERE id = ?', [matchedSlot.id]);
            } catch (e) {}
        }, 4000);

        res.json({
            success: true,
            slot: matchedSlot.slot,
            room: matchedSlot.room,
            guest: matchedSlot.guest
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. BOOKINGS & ICAL SYNC
app.get('/api/bookings', (req, res) => {
    try {
        const source = req.query.source;
        let rows;
        if (source && source !== 'ALL') {
            rows = queryAll('SELECT * FROM bookings WHERE source = ? ORDER BY created_at DESC', [source]);
        } else {
            rows = queryAll('SELECT * FROM bookings ORDER BY created_at DESC');
        }
        res.json(rows.map(r => ({
            ...r,
            property: r.property_name
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings', (req, res) => {
    try {
        const { guest, property, checkIn, checkOut, source } = req.body;
        const id = `BK-${Math.floor(800 + Math.random() * 199)}`;
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const dates = `${checkIn || 'Σήμερα 15:00'} → ${checkOut || 'Αύριο 11:00'}`;

        execute(`
            INSERT INTO bookings (id, guest, property_name, source, dates, pin, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Στάλθηκε SMS')
        `, [id, guest, property, source || 'Direct / Manual', dates, pin]);

        // Automatically update the matching property card with guest & pin!
        execute(`
            UPDATE properties
            SET guest = ?, pin = ?, check_out = ?
            WHERE name = ?
        `, [`${guest} (Direct)`, pin, checkOut || '11:00', property]);

        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [property, `Δημιουργήθηκε χειροκίνητο PIN #${pin} για ${guest}`]);

        res.status(201).json({ id, guest, property, pin, dates, status: 'Στάλθηκε SMS' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings/sync-ical', (req, res) => {
    try {
        const sampleGuests = ['Thomas Lindqvist', 'Claire Dubois', 'Marco Bellini', 'Hannah Klein', 'Anna Lindberg'];
        const sources = ['Airbnb', 'Booking.com', 'Vrbo'];
        const randomGuest = sampleGuests[Math.floor(Math.random() * sampleGuests.length)];
        const randomSource = sources[Math.floor(Math.random() * sources.length)];

        const properties = queryAll('SELECT * FROM properties');
        const randomProp = properties[Math.floor(Math.random() * properties.length)] || { name: 'Στούντιο Κέντρο #101' };
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();
        const id = `BK-${Math.floor(200 + Math.random() * 700)}`;
        const dates = '28/11 15:00 → 02/12 11:00';

        execute(`
            INSERT INTO bookings (id, guest, property_name, source, dates, pin, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Στάλθηκε WhatsApp & Email')
        `, [id, randomGuest, randomProp.name, randomSource, dates, newPin]);

        // Update property card
        execute(`
            UPDATE properties
            SET guest = ?, pin = ?, check_out = '02/12 11:00'
            WHERE name = ?
        `, [`${randomGuest} (${randomSource})`, newPin, randomProp.name]);

        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES (?, ?, 'unlock')
        `, [randomProp.name, `Νέα κράτηση ${randomSource} (${randomGuest}) -> Παράχθηκε PIN #${newPin}`]);

        res.json({
            success: true,
            booking: { id, guest: randomGuest, property: randomProp.name, source: randomSource, dates, pin: newPin }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings/:id/resend-pin', (req, res) => {
    try {
        const booking = queryGet('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
        if (!booking) return res.status(404).json({ error: 'Η κράτηση δεν βρέθηκε.' });
        res.json({ success: true, message: `Ο κωδικός #${booking.pin} στάλθηκε στον επισκέπτη ${booking.guest}.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. STAFF
app.get('/api/staff', (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM staff ORDER BY created_at DESC');
        res.json(rows.map(r => ({ ...r, active: Boolean(r.active) })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/staff', (req, res) => {
    try {
        const { name, schedule, properties } = req.body;
        const id = `ST-${Date.now()}`;
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        execute(`
            INSERT INTO staff (id, name, pin, schedule, properties, active)
            VALUES (?, ?, ?, ?, ?, 1)
        `, [id, name, pin, schedule || 'Καθημερινά • 11:00 - 15:30', properties || 'Όλα τα Καταλύματα']);

        res.status(201).json({ id, name, pin, schedule, properties, active: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/staff/:id/toggle', (req, res) => {
    try {
        const member = queryGet('SELECT * FROM staff WHERE id = ?', [req.params.id]);
        if (!member) return res.status(404).json({ error: 'Το μέλος προσωπικού δεν βρέθηκε.' });

        const newActive = member.active ? 0 : 1;
        execute('UPDATE staff SET active = ? WHERE id = ?', [newActive, req.params.id]);
        res.json({ success: true, active: Boolean(newActive), name: member.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. AUDIT LOGS
app.get('/api/logs', (req, res) => {
    try {
        const propFilter = req.query.property;
        let rows;
        if (propFilter && propFilter !== 'ALL') {
            rows = queryAll('SELECT * FROM audit_logs WHERE property_name = ? ORDER BY id DESC LIMIT 50', [propFilter]);
        } else {
            rows = queryAll('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50');
        }
        res.json(rows.map(r => ({
            id: r.id,
            property: r.property_name,
            event: r.event,
            type: r.event_type,
            time: new Date(r.created_at).toLocaleTimeString('el-GR')
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. QUOTES & LEADS (Submitted from the public website contact form)
app.get('/api/quotes', (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM quotes ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/quotes', (req, res) => {
    try {
        const { fullName, phone, email, packageName, notes } = req.body;
        if (!fullName || !phone || !email) {
            return res.status(400).json({ error: 'Όνομα, τηλέφωνο και email είναι υποχρεωτικά.' });
        }

        execute(`
            INSERT INTO quotes (full_name, phone, email, package_name, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [fullName, phone, email, packageName || 'Pro Energy & Access (650€)', notes || '']);

        execute(`
            INSERT INTO audit_logs (property_name, event, event_type)
            VALUES ('Website Leads', ?, 'staff')
        `, [`Νέο αίτημα προσφοράς από ${fullName} (${phone}) για ${packageName}`]);

        res.status(201).json({ success: true, message: 'Το αίτημα προσφοράς καταχωρήθηκε στη βάση SQL επιτυχώς!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. SETTINGS
app.get('/api/settings', (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM settings');
        const settingsMap = {};
        for (const r of rows) settingsMap[r.key] = r.value;
        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings', (req, res) => {
    try {
        const { key, value } = req.body;
        execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
        res.json({ success: true, key, value });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. INTERACTIVE SQL CONSOLE & DATABASE EXPLORER
app.get('/api/sql/tables', (req, res) => {
    try {
        const tables = queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC");
        const tableDetails = tables.map(t => {
            const rowCount = queryGet(`SELECT COUNT(*) as c FROM "${t.name}"`).c;
            const columns = queryAll(`PRAGMA table_info("${t.name}")`).map(col => ({
                name: col.name,
                type: col.type,
                notnull: Boolean(col.notnull),
                pk: Boolean(col.pk)
            }));
            return {
                name: t.name,
                rowCount,
                columns
            };
        });
        res.json(tableDetails);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sql/query', (req, res) => {
    try {
        const { sql } = req.body;
        if (!sql || typeof sql !== 'string') {
            return res.status(400).json({ error: 'Απαιτείται SQL εντολή.' });
        }

        const trimmed = sql.trim();
        const start = performance.now();

        if (trimmed.toLowerCase().startsWith('select') || trimmed.toLowerCase().startsWith('pragma') || trimmed.toLowerCase().startsWith('explain')) {
            const rows = queryAll(trimmed);
            const durationMs = (performance.now() - start).toFixed(2);
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            res.json({
                type: 'SELECT',
                rowCount: rows.length,
                columns,
                rows,
                durationMs
            });
        } else {
            const result = execute(trimmed);
            const durationMs = (performance.now() - start).toFixed(2);
            res.json({
                type: 'WRITE',
                changes: result.changes,
                lastInsertRowid: Number(result.lastInsertRowid),
                durationMs
            });
        }
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Start Express HTTP Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SmartStay Pro Full-Stack Server with SQL Database`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🌐 Public Website:  http://localhost:${PORT}/`);
    console.log(`⚙️ Admin Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`💾 SQL Database:   smartstay.db (SQLite3 engine)`);
    console.log(`=======================================================`);
});
