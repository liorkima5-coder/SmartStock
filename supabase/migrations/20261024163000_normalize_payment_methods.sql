-- Unify payment method labels (old Flask app stored English, newer UI stored Hebrew)
update public.orders set payment_method = 'מזומן' where payment_method in ('Cash', 'cash');
update public.orders set payment_method = 'אשראי' where payment_method in ('Credit', 'credit', 'Card', 'card');
update public.orders set payment_method = 'ביט' where payment_method in ('Bit', 'bit');
