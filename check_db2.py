import pymysql
conn = pymysql.connect(host='127.0.0.1', user='root', password='', db='corpoelec_almacen')
cur = conn.cursor()
cur.execute("SHOW TABLES LIKE 'usuarios'")
print(cur.fetchone())
conn.close()
