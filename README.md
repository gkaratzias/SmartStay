# SmartStay Pro — Full-Stack IoT Platform with SQL Database

Πλήρης Full-Stack πλατφόρμα αυτοματισμού Airbnb & έξυπνων καταλυμάτων με **πραγματική SQL βάση δεδομένων (SQLite3 engine)**, **Node.js/Express REST API backend** και δυναμικό frontend (Δημόσια Ιστοσελίδα + Cloud SaaS Διαχειριστικό).

---

## 🚀 Γρήγορη Εκκίνηση (Quick Start)

Στον τερματικό φάκελο του project εκτελέστε:

```bash
npm start
```
*(ή εναλλακτικά `node server.js`)*

Ο server θα ξεκινήσει αμέσως:
- 🌐 **Δημόσια Ιστοσελίδα:** [http://localhost:3000/](http://localhost:3000/)
- ⚙️ **Διαχειριστικό Πάνελ (Admin SaaS):** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- 💾 **Βάση Δεδομένων SQL:** `smartstay.db`

---

## 🗄️ Αρχιτεκτονική Βάσης Δεδομένων (SQL Database)

Η βάση δεδομένων υποστηρίζεται από το native high-performance SQLite3 engine του Node.js (WAL mode για μέγιστη ταχύτητα και αξιοπιστία) και περιλαμβάνει 7 πίνακες:

1. **`properties`**: Ακίνητα, Lock IDs, κατάσταση κλειδώματος (0/1), μπαταρία, ρελέ ρεύματος (0/1), τρέχων επισκέπτης, ενεργό PIN.
2. **`lockers`**: Θυρίδες εισόδου reception (Kiosk A & Modular Wall B), δωμάτιο, κατάσταση (`key_inside`, `picked_up`, `free`), PIN, κατάσταση πόρτας (`door_open`).
3. **`bookings`**: Κρατήσεις από Airbnb, Booking.com, Vrbo & χειροκίνητες, ημερομηνίες, αυτόματα PINs.
4. **`staff`**: Κωδικοί πρόσβασης προσωπικού καθαριότητας και τεχνικών με χρονοπρογραμματισμό και ενεργοποίηση/αναστολή.
5. **`audit_logs`**: Πλήρες ιστορικό συμβάντων (ξεκλείδωμα, διακοπή ρεύματος, είσοδος προσωπικού) με ακρίβεια δευτερολέπτου.
6. **`quotes`**: Εισερχόμενα αιτήματα προσφοράς και leads από τη φόρμα της δημόσιας ιστοσελίδας.
7. **`settings`**: Ρυθμίσεις πλατφόρμας, white-label επωνυμία και όρια συνδρομών.

*Το αρχείο DDL schema βρίσκεται στο [schema.sql](file:///c:/github/SmartStay/schema.sql).*

---

## 📡 REST API Endpoints

- `GET /api/stats` — Live KPI counters υπολογισμένα με SQL aggregates
- `GET /api/properties` — Ανάκτηση όλων των καταλυμάτων
- `POST /api/properties` — Προσθήκη νέου καταλύματος (SQL INSERT)
- `PUT /api/properties/:id/toggle-lock` — Εντολή κλειδώματος/ξεκλειδώματος (SQL UPDATE)
- `PUT /api/properties/:id/toggle-power` — Διακόπτης ρεύματος Tuya relay (SQL UPDATE)
- `GET /api/lockers` — Ανάκτηση θυρίδων ρεσεψιόν
- `POST /api/lockers/assign` — Ανάθεση θυριδίου & παραγωγή PIN
- `POST /api/lockers/unlock` — Απομακρυσμένο άνοιγμα θυριδίου
- `POST /api/lockers/kiosk-submit` — Εξαργύρωση PIN από το Kiosk εισόδου με SQL validation
- `GET /api/bookings` — Κρατήσεις με δυνατότητα φιλτραρίσματος καναλιού (`?source=Airbnb`)
- `POST /api/bookings` — Χειροκίνητη κράτηση & αυτόματη ενημέρωση του ακινήτου
- `POST /api/bookings/sync-ical` — Προσομοίωση ανάγνωσης iCal feed
- `GET /api/staff` — Προσωπικό & καθαριότητα
- `PUT /api/staff/:id/toggle` — Ενεργοποίηση / αναστολή κωδικού
- `GET /api/logs` — Live Audit Trail με φίλτρο ανά κατάλυμα
- `POST /api/quotes` — Αποθήκευση αιτήματος προσφοράς από τη δημόσια ιστοσελίδα
- `GET /api/sql/tables` — Schema inspection όλων των πινάκων SQL
- `POST /api/sql/query` — **Interactive SQL Query Runner** για άμεση εκτέλεση SQL εντολών από το διαχειριστικό!

---

## 🛠️ Interactive SQL Console & Database Explorer

Μέσα στο διαχειριστικό ([http://localhost:3000/dashboard](http://localhost:3000/dashboard)) υπάρχει η καρτέλα **«Βάση Δεδομένων SQL»**:
- Ζωντανή επισκόπηση όλων των πινάκων και των γραμμών τους.
- Προεπιλεγμένα queries (presets) για άμεση προβολή των δεδομένων.
- Κονσόλα για ελεύθερη πληκτρολόγηση οποιουδήποτε SQL query (π.χ. `SELECT * FROM quotes;`) με εμφάνιση αποτελεσμάτων σε διαδραστικό πίνακα και χρόνο εκτέλεσης σε ms.
