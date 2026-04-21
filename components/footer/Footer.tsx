import styles from "./footer.module.css";
import { APP_VERSION } from "@/lib/version";

export default function Footer() {
    return(
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <p className={styles.copyright}>&copy; Grahm Digital 2026 | Alle Rechte Vorbehalten.</p>
                <p className={styles.verion}>Version: {APP_VERSION}</p>
            </div>
        </footer>
    );
}