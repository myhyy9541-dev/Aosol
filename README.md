# Aosol — إدارة الأصول الثابتة

إصدار مكتبي مستقل ببايثون لإدارة سجل الأصول الثابتة وحساب الإهلاك، أُضيف إلى المستودع إلى جانب تطبيق الويب الحالي دون استبداله. الواجهة عربية، والبيانات تحفظ محليًا في SQLite على الجهاز؛ لا يتطلب البرنامج اتصالًا بالإنترنت بعد تثبيته.

## الوظائف

- إضافة الأصول وتعديلها وحذفها، مع رمز الأصل والتصنيف والتواريخ والتكلفة والعمر الإنتاجي والبيانات التشغيلية.
- حساب الإهلاك وفق القسط الثابت، والمتناقص المضاعف 200%، والمتناقص 150%، ومجموع أرقام السنين، ووحدات الإنتاج.
- عرض إجمالي التكلفة ومجمع الإهلاك وصافي القيمة الدفترية وجدول الإهلاك.
- تسجيل بيع/استبعاد الأصل واحتساب الربح أو الخسارة، ثم استعادته عند الحاجة.
- استيراد CSV وExcel ونسخ Aosol الاحتياطية JSON، وتصدير سجل الأصول إلى Excel/CSV.
- إنشاء نسخة احتياطية واستعادتها، وتعديل اسم المنشأة والعملة.

## تشغيل من المصدر

يتطلب Python 3.10 أو أحدث. على Windows، افتح PowerShell في مجلد المستودع ونفّذ:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

على Linux/macOS ثبّت حزمة Tkinter الخاصة بتوزيعتك عند الحاجة، ثم ثبّت المتطلبات وشغّل `python3 main.py`.

## إنشاء ملف EXE على Windows

```powershell
python -m pip install -r requirements.txt
pyinstaller --noconfirm --clean --onefile --windowed --name Aosol --icon assets/aosol.ico main.py
```

يظهر الملف في `dist/Aosol.exe`. ويمكن أيضًا تنزيل نسخة Windows الجاهزة من تبويب **Actions** في GitHub، من آخر تشغيل ناجح لعملية **Build Aosol Windows EXE** عبر تنزيل عنصر `Aosol-Windows-EXE`.

## الاختبارات

```bash
python -m unittest discover -s tests -v
```

## مكان تخزين البيانات

- Windows: `%APPDATA%\Aosol\aosol.db`
- Linux: `~/.local/share/aosol/aosol.db`
- macOS: `~/Library/Application Support/Aosol/aosol.db`

احفظ نسخة احتياطية قبل نقل البيانات إلى جهاز آخر أو إعادة تثبيت النظام. الإصدار المكتبي قاعدة بيانات مستقلة عن التخزين المحلي للمتصفح المستخدم في تطبيق الويب الحالي.
