<?php
/**
 * Comprueba la conexión MySQL de Alvarez Fast Food (XAMPP).
 * Abrir: http://localhost/alvarez_fastfood/database/verificar.php
 * (copie el proyecto a htdocs si aún no está ahí)
 */
header('Content-Type: text/html; charset=utf-8');
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'alvarez_fastfood';

echo '<h1>Alvarez Fast Food — MySQL</h1>';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo '<p style="color:green">✓ Servidor MySQL conectado</p>';

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$db`");

    $ventas = (int) $pdo->query('SELECT COUNT(*) FROM ventas')->fetchColumn();
    $lineas = (int) $pdo->query('SELECT COUNT(*) FROM lineas_venta')->fetchColumn();

    echo "<p>Base de datos: <strong>$db</strong></p>";
    echo "<p>Ventas registradas: <strong>$ventas</strong></p>";
    echo "<p>Líneas de venta: <strong>$lineas</strong></p>";
    echo '<p><a href="http://localhost/phpmyadmin">Abrir phpMyAdmin</a></p>';
} catch (PDOException $e) {
    echo '<p style="color:red">✗ ' . htmlspecialchars($e->getMessage()) . '</p>';
    echo '<p>Inicie MySQL en XAMPP e importe <code>schema.sql</code> en phpMyAdmin.</p>';
}
