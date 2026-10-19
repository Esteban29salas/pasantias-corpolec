import openpyxl
from datetime import datetime
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def generar_excel_kardex(info_producto, lista_movimientos):
    print("============================================")
    print("DEBUG UTILS - info_producto recibido:", info_producto)
    print("DEBUG UTILS - valor observaciones:", info_producto.get('observaciones_generales'))
    print("============================================")


    # ... resto del código ...

    wb = openpyxl.Workbook()
    ws = wb.active

    codigo_acta = info_producto.get('codigo_sap', '00001')
    ws.title = f"Carta_RD_{codigo_acta}"
    ws.views.sheetView[0].showGridLines = True

    

    # Estilos de Fuente y Colores
    font_titulo = Font(name='Arial', size=12, bold=True, color='002060')
    font_subtitulo = Font(name='Arial', size=10, bold=True)
    font_label = Font(name='Arial', size=8, bold=True)
    font_valor = Font(name='Arial', size=9, bold=False)
    font_header = Font(name='Arial', size=8, bold=True, color='FFFFFF')
    font_data = Font(name='Arial', size=8)

    fill_header = PatternFill(start_color='1F4E78', end_color='1F4E78', fill_type='solid')
    fill_sub_header = PatternFill(start_color='2F5597', end_color='2F5597', fill_type='solid')
    thin = Side(style='thin', color='B0C4DE')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # 1. Título Principal
    ws.merge_cells('A2:K2')
    ws['A2'] = "KARDEX DE ALMACÉN - REGISTRO DIARIO"
    ws['A2'].font = font_titulo
    ws['A2'].alignment = Alignment(horizontal='center', vertical='center')

    # 2. Rellenar Información de Cabecera del Producto
    ws['A4'] = "CENTRO DE SERVICIO TIPO C LA FRIA"
    ws['A4'].font = font_subtitulo
    ws['A4'].alignment = Alignment(horizontal='center', vertical='center')

#--- 2. BLOQUE ADMINISTRACION Y FECHA---
    fecha_hoy = datetime.now().strftime('%d/%m/%Y')
    fecha_mov = info_producto.get('fecha_ingresada', fecha_hoy)

    ws.merge_cells('A7:C7'); ws['A7'] = "01.-FECHA"; ws['A7'].font = font_label
    ws.merge_cells('A8:C8'); ws['A8'] = fecha_mov; ws['A8'].font = font_valor; ws['A8'].alignment = Alignment(horizontal='center')

    ws['D7'] = "CECO"; ws['D7'].font = font_label
    ws['D8'] = "E350203"; ws['D8'].font = font_valor; ws['D8'].alignment = Alignment(horizontal='center')

    ws.merge_cells('E7:I7'); ws['E7'] = "ESTRUCTURA:"; ws['E7'].font = font_label
    ws.merge_cells('E8:I8'); ws['E8'] = "40001445"; ws['E8'].font = font_valor

    ws['J7'] = "03.- ENTRADA:"; ws['J7'].font = font_valor
    ws['J8'] = ""

    ws['K7'] = "04.- SALIDA:"; ws['K7'].font = font_label
    ws['K8'] = "X"
    ws['K8'].font = font_valor

    # 3. Encabezados de la Tabla
    ws.merge_cells('A9:F9'); ws['A9'] = "05.- UNIDAD TECNICA:"; ws['A9'].font = font_label
    ws.merge_cells('A10:F10'); ws['A10'] = "DPTO MTTO Y ATC AVER SC TC LA FRIA TACHIRA"; ws['A10'].font = font_valor
    ws.merge_cells('G9:I9'); ws['G9'] = "06.- ORDEN DE TRABAJO /ACTA N°:"; ws['G9'].font = font_label
    ws.merge_cells('G10:I10'); ws['G10'] = codigo_acta; ws ['G10'].font = font_valor; ws['G10'].alignment = Alignment(horizontal='center')
    ws.merge_cells('J9:K9'); ws['J9'] = "MATERIAL DEVUELTO"; ws['J9'].font = font_label
    ws.merge_cells('J10:K10'); ws['J10'] = "FECHA: ____/____/____"; ws['J10'].font = font_valor; ws['J10'].alignment = Alignment(horizontal='center')

    for r in range(7, 11):
            for c in range(1, 12):
                cell = ws.cell(row=r, column=c)
                cell.border = border
                if r in [7, 9]:
                    cell.fill = fill_sub_header

    ws.merge_cells('A11:C11'); ws['A11'] = "07.- CÓDIGO SAP"
    ws.merge_cells('D11:E11'); ws['D11'] = "08.- DESCRIPCIÓN"
    ws['F11'] = "09.- U." \
        "M."
    ws['G11'] = "10.- COND."
    ws['H11'] = "11.- CANT. DESP."
    ws['I11'] = "12.- CANT. DEV."
    ws['J11'] = "13.- OBSERVACIÓN"
    ws['K11'] = "14.- PAG"



    # Estilar Encabezados (Filas 6 y 7)
    for c in range(1, 12):
        cell = ws.cell(row=11, column=c)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

#---5. DETALLES DE MATERIALES ---

    curr_row = 12
    for item in lista_movimientos:
        ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=3)
        ws.cell(row=curr_row, column=1, value=str(item.get('codigo_sap',''))).alignment = Alignment(horizontal='center')

        ws.merge_cells(start_row=curr_row, start_column=4, end_row=curr_row, end_column=5)
        ws.cell(row=curr_row, column=4, value=str(item.get('descripcion', ''))).alignment = Alignment(horizontal='left')

        ws.cell(row=curr_row, column=6, value=str(item.get('unidad_medida', 'UND'))).alignment = Alignment(horizontal='center')

        ws.cell(row=curr_row, column=7, value=item.get('condicion', 'OPERATIVO')).alignment = Alignment(horizontal='center')

        ws.cell(row=curr_row, column=8, value=item.get('cantidad_despachada', item.get('cantidad_despachada', 0))).alignment = Alignment(horizontal='right')

        ws.cell(row=curr_row, column=9, value=item.get('cantidad_devuelta', 0)).alignment = Alignment(horizontal='right')
        ws.cell(row=curr_row, column=10, value=str(item.get('observacion', '')))

        ws.cell(row=curr_row, column=11, value=item.get('pag', 1)).alignment = Alignment(horizontal='center')

        for c in range(1, 12):
            cell = ws.cell(row=curr_row, column=c)
            cell.font = font_data
            cell.border = border

        curr_row += 1

    # Rellenar renglones vacíos para mantener estructura fija hasta la fila 24
    while curr_row <= 24:
        ws.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=3)
        ws.merge_cells(start_row=curr_row, start_column=4, end_row=curr_row, end_column=5)
        for c in range(1, 12):
            ws.cell(row=curr_row, column=c).border = border
        curr_row += 1

    # --- 6. OBSERVACIONES ---
    ws.merge_cells('A25:K25')
    ws['A25'] = "15.- OBSERVACIONES GENERALES:"
    ws['A25'].font = font_label
    ws['A25'].fill = fill_sub_header

# 1. Unificar el rango para las observaciones generales
    ws.merge_cells('A26:K29')

    # 2. Aplicar los bordes primero a todas las celdas del bloque (filas 25 a 29)
    for r in range(25, 30):
        for c in range(1, 12):
            ws.cell(row=r, column=c).border = border

    # 3. Asignar el valor y la alineación a la celda principal A26 AL FINAL
    ws['A26'] = info_producto.get('observaciones_generales', '')
    ws['A26'].alignment = Alignment(vertical='top', horizontal='left', wrap_text=True)
    # --- 7. BLOQUE DE FIRMAS ---
# Ejemplo si info_producto tiene 'entregado_por_nombre' y 'entregado_por_ci'
# o si concatenas adecuadamente:

# 2. Asignar las firmas directamente obteniendo el texto adecuado
    entregado_txt = info_producto.get('entregado_por', '')
    retirado_txt = info_producto.get('retirado_por', '')

    # Formato de texto con Nombre / C.I. y Firma
# Función de formateo interno para asegurar Nombre + Cédula
# Función de formateo interno
    def armar_texto_persona(val):
        if not val:
            return ""
        
        val_str = str(val).strip()

        # Si viene del frontend "25626343 - jose carlos santander lulu"
        if ' - ' in val_str:
            partes = val_str.split(' - ', 1)
            cedula = partes[0].strip()
            nombre = partes[1].strip().title()
            return f"{nombre} / C.I.: {cedula}"

        # Si viene solo la cédula numerica
        if val_str.isdigit():
            from .models import Personal
            persona = Personal.objects.filter(cedula=val_str).first()
            if persona:
                nombre_comp = f"{persona.nombre} {persona.apellido}".strip().title()
                return f"{nombre_comp} / C.I.: {persona.cedula}"
            return f"C.I.: {val_str}"

        return val_str

    # Procesar los valores recibidos
    info_entregado = armar_texto_persona(entregado_txt) if entregado_txt else ""
    info_retirado = armar_texto_persona(retirado_txt) if retirado_txt else ""

    # Construir el texto final para las celdas SIN duplicar "Nombre / C.I.:"
    txt_entregado = f"Nombre / C.I.: {info_entregado}\nFirma: ________________________" if info_entregado else "Nombre / C.I.:\nFirma: ________________________"
    txt_retirado = f"Nombre / C.I.: {info_retirado}\nFirma: ________________________" if info_retirado else "Nombre / C.I.:\nFirma: ________________________"

    # Fila fija 31 para encabezados de firma
    ws.merge_cells('A31:E31')
    ws['A31'] = "16.- ENTREGADO POR:"
    ws['A31'].font = font_label
    ws['A31'].fill = fill_sub_header

    ws.merge_cells('F31:K31')
    ws['F31'] = "17.- RECIBIDO / RETIRADO POR:"
    ws['F31'].font = font_label
    ws['F31'].fill = fill_sub_header

    # Celdas para el texto de las firmas
    ws.merge_cells('A32:E34')
    ws['A32'] = txt_entregado
    ws['A32'].font = font_valor
    ws['A32'].alignment = Alignment(vertical='top', wrap_text=True)

    ws.merge_cells('F32:K34')
    ws['F32'] = txt_retirado
    ws['F32'].font = font_valor
    ws['F32'].alignment = Alignment(vertical='top', wrap_text=True)

    # Bordes para las firmas (filas 31 a 34)
    for r in range(31, 35):
        for c in range(1, 12):
            ws.cell(row=r, column=c).border = border

    # Anchos de columna optimizados
    anchos = {'A': 12, 'B': 12, 'C': 12, 'D': 25, 'E': 25, 'F': 10, 'G': 12, 'H': 14, 'I': 14, 'J': 20, 'K': 8}
    for col_letter, w in anchos.items():
        ws.column_dimensions[col_letter].width = w

    return wb