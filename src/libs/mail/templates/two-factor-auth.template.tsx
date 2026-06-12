import { Body, Heading, Tailwind, Text } from '@react-email/components';
import { Html } from '@react-email/html';

interface TwoFactorProps {
    token: string;
}

export function TwoFactor({ token }: TwoFactorProps) {
    return (
        <Tailwind>
            <Html>
                <Body className="text-black">
                    <Heading>Two-Factor Authentication</Heading>
                    <Text>
                        Your code: <strong>{token}</strong>
                    </Text>
                    <Text>
                        Please enter this code in the app to complete the
                        authentication process.
                    </Text>
                </Body>
            </Html>
        </Tailwind>
    );
}
