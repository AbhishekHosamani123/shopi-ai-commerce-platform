import express, { Request, Response } from 'express';
import { client } from '../data/DB';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { matchedData, validationResult } from 'express-validator';
import { AddressUpdateSchema, cartQtyUpdate, defaultUpdateSchema, insertAddressSchema, userUpdateSchema } from '../validators/userUpdateValidation';
import { randomUUID } from 'crypto';

const saltRounds = 10;
const router = express.Router();
const userTable = 'users';
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY as string;

function getAuthenticatedUserID(req: Request): number | null {
    const token = req.headers['authorization']?.split(' ')[1] || req.headers['x-user-token'] as string;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userID: number };
        return decoded.userID;
    } catch {
        return null;
    }
}


// Update user route
router.put('/user',userUpdateSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { userName, email, password, mobile_number, dob, userID } = matchedData(req);

        const authenticatedUserID = getAuthenticatedUserID(req);
        if (!authenticatedUserID || Number(authenticatedUserID) !== Number(userID)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updatedIP = req.ip; // Capture the IP address from the request

        try {
            // Validate input (optional)
            const updates = [];
            const values = [];
            let valueIndex = 1;

            if (userName) {
                updates.push(`userName = $${valueIndex++}`);
                values.push(userName);
            }
            if (email) {
                updates.push(`email = $${valueIndex++}`);
                values.push(email);
            }
            if (password) {
                const hash = await bcrypt.hash(password, saltRounds);
                updates.push(`password = $${valueIndex++}`);
                values.push(hash);
            }
            if (mobile_number) {
                updates.push(`mobile_number = $${valueIndex++}`);
                values.push(mobile_number);
            }
            if (dob) {
                updates.push(`dob = $${valueIndex++}`);
                values.push(dob);
            }

            // Always update the updated_ip field
            updates.push(`update_ip = $${valueIndex++}`);
            values.push(updatedIP);

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields provided for update' });
            }

            values.push(userID);
            const updateQuery = `UPDATE "${userTable}" SET ${updates.join(', ')} WHERE userID = $${valueIndex}`;

            await client.query(updateQuery, values);

            res.status(200).json({ message: 'User updated successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    }
    else
    {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
});
router.put('/user/update/address',AddressUpdateSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { userID, addressID, addressType, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, userName } = matchedData(req);

        const authenticatedUserID = getAuthenticatedUserID(req);
        if (!authenticatedUserID || Number(authenticatedUserID) !== Number(userID)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updateQuery = `
            UPDATE addresses 
            SET addresstype = $1, contactnumber = $2, addressline1 = $3, addressline2 = $4, city = $5, state = $6, country = $7, postalcode = $8, username = $9 
            WHERE addressid = $10 AND userid = $11
        `;
        const values = [addressType, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, userName, addressID, userID];
    
        try {
            await client.query(updateQuery, values);
            res.status(200).json({ message: 'Address updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
    else
    {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
});
// Add User Address
router.post('/user/insert/address',insertAddressSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { addressType, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, userName, userID } = matchedData(req);

        const authenticatedUserID = getAuthenticatedUserID(req);
        if (!authenticatedUserID || Number(authenticatedUserID) !== Number(userID)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        let is_default = false;
        const insertQuery = `
            INSERT INTO addresses (addresstype, userid, contactnumber, addressline1, addressline2, city, state, country, postalcode, username, is_default) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING addressid
        `;
        const checkQuery = `SELECT addressid FROM addresses WHERE userid = $1`;
    
        try {
            const response = await client.query(checkQuery,[userID]);
            if(response.rows.length===0) is_default=true;
            const values = [addressType, userID, contactNumber, addressLine1, addressLine2, city, state, country, postalCode, userName, is_default];
            const insertResult = await client.query(insertQuery, values);
            const addressID = insertResult.rows[0].addressid;
            res.status(200).json({ message: 'Address added successfully', addressid: addressID });
        } catch (error) {
            console.error('Error inserting address:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }else
    {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
});

// Delete User Address
router.delete('/user/delete/address',defaultUpdateSchema, async (req: Request, res: Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { addressID, userID } = matchedData(req);

        const authenticatedUserID = getAuthenticatedUserID(req);
        if (!authenticatedUserID || Number(authenticatedUserID) !== Number(userID)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            // Prevent deleting the default address
            const checkDefaultQuery = `SELECT is_default FROM addresses WHERE addressid = $1 AND userid = $2`;
            const checkResult = await client.query(checkDefaultQuery, [addressID, userID]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json({ message: 'Address not found' });
            }
            if (checkResult.rows[0].is_default) {
                return res.status(400).json({ message: 'Cannot delete the default address. Set another address as default first.' });
            }

            const deleteQuery = `DELETE FROM addresses WHERE addressid = $1 AND userid = $2`;
            await client.query(deleteQuery, [addressID, userID]);
            res.status(200).json({ message: 'Address deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }else
    {
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
});
router.post('/user/set-default-address',defaultUpdateSchema, async (req:Request, res:Response) => {
    const result = validationResult(req);
    if(result.isEmpty()){
        const { addressID, userID } = matchedData(req);

        const authenticatedUserID = getAuthenticatedUserID(req);
        if (!authenticatedUserID || Number(authenticatedUserID) !== Number(userID)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const conn = await client.connect();
        try {
          await conn.query('BEGIN');
          await conn.query(
            `UPDATE addresses SET is_default = false WHERE userid = $1 AND is_default = true`,
            [userID]
          );
          await conn.query(
            `UPDATE addresses SET is_default = true WHERE addressid = $1 AND userid = $2`,
            [addressID, userID]
          );
          await conn.query('COMMIT');
          res.sendStatus(200);
        } catch (error) {
          await conn.query('ROLLBACK');
          console.error('Error setting default address:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        } finally {
          conn.release();
        }
    }else{
        console.log(result);
        res.status(500).json({ message: 'Validation error' });
    }
});
router.post('/user/cart-quantity',cartQtyUpdate,async (req:Request,res:Response)=>{
    const result = validationResult(req);
    if(result.isEmpty()){
        const {cartItemID,productID,userID,action} = matchedData(req);
        try {
            const incrementQuery = `UPDATE cartitems SET quantity = quantity + 1 WHERE userid = $1 AND cartitemid = $2 AND productid = $3`;
            if(action==='increment'){
                await client.query(incrementQuery,[userID,cartItemID,productID]);
                return res.status(200).json({message:'Successfully incremented'});
            }else{
                // Check current quantity before decrementing
                const checkQuery = `SELECT quantity FROM cartitems WHERE userid = $1 AND cartitemid = $2 AND productid = $3`;
                const checkResult = await client.query(checkQuery,[userID,cartItemID,productID]);
                if(checkResult.rows.length === 0) {
                    return res.status(404).json({error:'Cart item not found'});
                }
                if(checkResult.rows[0].quantity <= 1) {
                    return res.status(400).json({error:'Quantity cannot be less than 1'});
                }
                const decrementQuery = `UPDATE cartitems SET quantity = quantity - 1 WHERE userid = $1 AND cartitemid = $2 AND productid = $3`;
                await client.query(decrementQuery,[userID,cartItemID,productID]);
                return res.status(200).json({message:'Successfully decremented'});
            }
        } catch (error) {
            res.status(500).json({error:'Faced an error while updating'});
        }
    }else{
        console.log(result);
        res.status(500).json({error:'Validation Error'})
    }
})
export default router;
