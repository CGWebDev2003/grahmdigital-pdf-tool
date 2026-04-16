import styles from "./footer.module.css";

export default function Footer() {
    return(
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <p className={styles.copyright}>&copy; Grahm Digital 2026 | Alle Rechte Vorbehalten.</p>
                <p className={styles.verion}>Version: v0.1.0</p>
            </div>
        </footer>
    );
}